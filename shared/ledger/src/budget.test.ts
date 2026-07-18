import { describe, expect, it } from "vitest";
import { BudgetMiddleware } from "./budget.js";
import { MemoryLedger } from "./types.js";
import { summarizeOrderCosts, waMessageCostUsd } from "./meters.js";
import { AGENT_REGISTRY } from "./registry.js";

describe("agent registry (§5)", () => {
  it("pins the hard budgets from the requirements doc", () => {
    expect(AGENT_REGISTRY.router.budgetPerCallUsd).toBe(0);
    expect(AGENT_REGISTRY.commande.budgetPerCallUsd).toBe(0.005);
    expect(AGENT_REGISTRY.adresse.budgetPerCallUsd).toBe(0.006);
    expect(AGENT_REGISTRY.lipa.budgetPerCallUsd).toBe(0.0002);
    expect(AGENT_REGISTRY["cuisine-sync"].budgetPerCallUsd).toBe(0.008);
    expect(AGENT_REGISTRY["wewa-dispatch"].budgetPerCallUsd).toBe(0);
    expect(AGENT_REGISTRY.litige.budgetPerOrderUsd).toBe(0.01);
    expect(AGENT_REGISTRY["mama-upsell"].budgetPerCallUsd).toBe(0.004);
  });
});

describe("BudgetMiddleware (FR-A1)", () => {
  it("meters spend and ledgers the invocation", async () => {
    const ledger = new MemoryLedger();
    const budget = new BudgetMiddleware(ledger);
    const result = await budget.run(
      "commande",
      { tkRef: "TK-347", purpose: "free text → cart" },
      async () => ({ value: "parsed", costUsd: 0.004 }),
      () => "fallback",
    );
    expect(result).toBe("parsed");
    expect(ledger.events).toHaveLength(1);
    expect(ledger.events[0]).toMatchObject({
      type: "ai",
      agent: "commande",
      costUsd: 0.004,
      tkRef: "TK-347",
    });
  });

  it("hard-stops per-order caps with a deterministic fallback", async () => {
    const ledger = new MemoryLedger();
    const budget = new BudgetMiddleware(ledger);
    const invoke = async () => ({ value: "llm", costUsd: 0.006 });
    const fallback = () => "buttons";

    // First call spends 0.006 of the litige per-order cap (0.01)…
    const first = await budget.run(
      "litige",
      { tkRef: "TK-1", purpose: "dispute round 1" },
      invoke,
      fallback,
    );
    expect(first).toBe("llm");

    // …second call only has 0.004 left; result costing 0.006 is discarded.
    const second = await budget.run(
      "litige",
      { tkRef: "TK-1", purpose: "dispute round 2" },
      invoke,
      fallback,
    );
    expect(second).toBe("buttons");

    // Third call: cap fully exhausted → immediate fallback, no invocation.
    const third = await budget.run(
      "litige",
      { tkRef: "TK-1", purpose: "dispute round 3" },
      async () => {
        throw new Error("must not be invoked");
      },
      fallback,
    );
    expect(third).toBe("buttons");
    expect(
      ledger.events.filter((e) => e.type === "budget-exhausted"),
    ).toHaveLength(2);
  });

  it("degrades to fallback on provider failure, never to an error", async () => {
    const ledger = new MemoryLedger();
    const budget = new BudgetMiddleware(ledger);
    const result = await budget.run(
      "commande",
      { purpose: "flaky provider" },
      async () => {
        throw new Error("upstream 500");
      },
      () => "buttons",
    );
    expect(result).toBe("buttons");
  });
});

describe("cost meters (FR-M4, §2.3 ceilings)", () => {
  it("summarizes per-order AI and messaging spend against ceilings", () => {
    const ledger = new MemoryLedger();
    const at = new Date();
    ledger.write({ type: "ai", agent: "commande", purpose: "parse", costUsd: 0.005, tkRef: "TK-9", at });
    ledger.write({ type: "ai", agent: "adresse", purpose: "stt", costUsd: 0.006, tkRef: "TK-9", at });
    ledger.write({ type: "wa-message", agent: "system", purpose: "resto template", costUsd: waMessageCostUsd("utility-template"), tkRef: "TK-9", at });
    ledger.write({ type: "wa-message", agent: "system", purpose: "customer milestone", costUsd: waMessageCostUsd("customer-service-window"), tkRef: "TK-9", at });
    ledger.write({ type: "block", agent: "router", purpose: "off-topic", costUsd: 0, tkRef: "TK-9", at });

    const s = summarizeOrderCosts("TK-9", ledger.events);
    expect(s.aiUsd).toBeCloseTo(0.011, 6);
    expect(s.waUsd).toBeCloseTo(0.008, 6);
    expect(s.blockedLlmCalls).toBe(1);
    expect(s.withinAiCeiling).toBe(true);
    expect(s.withinWaCeiling).toBe(true);
  });
});
