import { describe, expect, it } from "vitest";
import { BudgetMiddleware } from "./budget.js";
import {
  acuMultiplier,
  InMemoryAcuWallet,
  RESALE_MULTIPLIER,
  usdToAcu,
  USD_PER_ACU,
} from "./acu.js";
import { MemoryLedger } from "./types.js";

describe("ACU conversion & multiplier", () => {
  it("converts USD to ACU, rounding up, at 1 ACU = $0.001", () => {
    expect(USD_PER_ACU).toBe(0.001);
    expect(usdToAcu(0.05, "commande")).toBe(50); // internal 1×
    expect(usdToAcu(0.0001, "commande")).toBe(1); // fractional rounds up
  });

  it("applies the 3× resale multiplier to partner-facing agents", () => {
    expect(acuMultiplier("commande")).toBe(1);
    expect(acuMultiplier("seo")).toBe(RESALE_MULTIPLIER);
    expect(acuMultiplier("growth")).toBe(RESALE_MULTIPLIER);
    // $0.01 growth call = 10 ACU internal → 30 ACU resold.
    expect(usdToAcu(0.01, "growth")).toBe(30);
  });
});

describe("InMemoryAcuWallet reserve/commit/release", () => {
  it("reserves against balance and refuses when short", () => {
    const w = new InMemoryAcuWallet({ acct: 40 });
    expect(w.reserve("acct", 50).ok).toBe(false); // 50 > 40
    const r = w.reserve("acct", 30);
    expect(r.ok).toBe(true);
    expect(w.balance("acct")).toBe(10); // 40 − 30 held
  });

  it("commit debits only actual usage and frees the rest of the hold", () => {
    const w = new InMemoryAcuWallet({ acct: 100 });
    const r = w.reserve("acct", 50);
    w.commit("acct", r.reserved, 20); // used 20 of 50
    expect(w.balance("acct")).toBe(80); // 100 − 20
  });

  it("release returns the whole hold (nothing consumed)", () => {
    const w = new InMemoryAcuWallet({ acct: 100 });
    const r = w.reserve("acct", 50);
    w.release("acct", r.reserved);
    expect(w.balance("acct")).toBe(100);
  });
});

describe("BudgetMiddleware ACU gating — no free AI action", () => {
  const gating = (initial: Record<string, number>) => {
    const wallet = new InMemoryAcuWallet(initial);
    return { wallet, defaultAccount: "platform" };
  };

  it("debits ACU on every successful AI call", async () => {
    const ledger = new MemoryLedger();
    const acu = gating({ platform: 1000 });
    const mw = new BudgetMiddleware(ledger, acu);
    await mw.run(
      "commande",
      { purpose: "parse" },
      async () => ({ value: "ok", costUsd: 0.005 }),
      () => "fallback",
    );
    // 0.005 USD internal → 5 ACU debited; balance 1000 − 5.
    expect(acu.wallet.balance("platform")).toBe(995);
    const dbt = ledger.events.find((e) => e.type === "ai");
    expect(dbt?.meta).toMatchObject({ acu: 5, account: "platform" });
  });

  it("REFUSES the AI call when the balance can't cover the max cost", async () => {
    const ledger = new MemoryLedger();
    const acu = gating({ platform: 3 }); // commande max = 5 ACU ($0.005)
    const mw = new BudgetMiddleware(ledger, acu);
    let invoked = false;
    const out = await mw.run(
      "commande",
      { purpose: "parse" },
      async () => {
        invoked = true;
        return { value: "llm", costUsd: 0.005 };
      },
      () => "buttons",
    );
    expect(out).toBe("buttons"); // gated → deterministic fallback
    expect(invoked).toBe(false); // the LLM never even ran
    expect(acu.wallet.balance("platform")).toBe(3); // nothing consumed
    expect(ledger.events.some((e) => e.type === "acu-gated")).toBe(true);
  });

  it("bills a partner account at the 3× resale rate and can exhaust it", async () => {
    const ledger = new MemoryLedger();
    const acu = gating({ "resto-17": 40 }); // growth max = 30 ACU resold
    const mw = new BudgetMiddleware(ledger, acu);
    // First growth call: 30 ACU reserved (0.01 × 3 / 0.001), fits in 40.
    await mw.run(
      "growth",
      { purpose: "post", account: "resto-17" },
      async () => ({ value: "post", costUsd: 0.01 }),
      () => "template",
    );
    expect(acu.wallet.balance("resto-17")).toBe(10); // 40 − 30
    // Second call needs 30 again but only 10 left → refused.
    const out = await mw.run(
      "growth",
      { purpose: "advert", account: "resto-17" },
      async () => ({ value: "ad", costUsd: 0.01 }),
      () => "template",
    );
    expect(out).toBe("template");
    expect(ledger.events.some((e) => e.type === "acu-gated")).toBe(true);
  });

  it("releases the ACU hold when the provider fails (nothing charged)", async () => {
    const ledger = new MemoryLedger();
    const acu = gating({ platform: 100 });
    const mw = new BudgetMiddleware(ledger, acu);
    const out = await mw.run(
      "commande",
      { purpose: "parse" },
      async () => {
        throw new Error("provider 503");
      },
      () => "buttons",
    );
    expect(out).toBe("buttons");
    expect(acu.wallet.balance("platform")).toBe(100); // hold released
  });

  it("without a wallet, behaviour is unchanged (USD metering only)", async () => {
    const ledger = new MemoryLedger();
    const mw = new BudgetMiddleware(ledger); // no gating
    const out = await mw.run(
      "commande",
      { purpose: "parse" },
      async () => ({ value: "ok", costUsd: 0.005 }),
      () => "fallback",
    );
    expect(out).toBe("ok");
    expect(ledger.events.find((e) => e.type === "ai")?.costUsd).toBeCloseTo(0.005);
  });
});

describe("ACU wallet — money-safety guards", () => {
  it("rejects non-positive / non-integer / non-finite top-ups", () => {
    const w = new InMemoryAcuWallet();
    expect(() => w.topUp("acct", 0)).toThrow(RangeError);
    expect(() => w.topUp("acct", -100)).toThrow(RangeError);
    expect(() => w.topUp("acct", 1.5)).toThrow(RangeError);
    expect(() => w.topUp("acct", NaN)).toThrow(RangeError);
    expect(() => w.topUp("acct", Infinity)).toThrow(RangeError);
    expect(w.balance("acct")).toBe(0); // nothing was written
  });

  it("refuses a NaN reservation instead of minting a hold", () => {
    const w = new InMemoryAcuWallet({ acct: 1000 });
    const res = w.reserve("acct", NaN);
    expect(res.ok).toBe(false);
    expect(res.reserved).toBe(0);
    expect(w.balance("acct")).toBe(1000); // balance intact, not NaN
  });

  it("cannot mint free ACU by double-releasing a hold", () => {
    const w = new InMemoryAcuWallet({ acct: 100 });
    const res = w.reserve("acct", 40);
    expect(res.ok).toBe(true);
    expect(w.balance("acct")).toBe(60);
    w.release("acct", 40);
    w.release("acct", 40); // stray second release must not inflate balance
    expect(w.balance("acct")).toBe(100); // never exceeds the real balance
  });

  it("never drives a balance negative on a stray double-commit", () => {
    const w = new InMemoryAcuWallet({ acct: 50 });
    const res = w.reserve("acct", 50);
    expect(res.ok).toBe(true);
    w.commit("acct", 50, 50);
    w.commit("acct", 50, 50); // stray replay
    expect(w.balance("acct")).toBe(0); // clamped, not negative
  });
});
