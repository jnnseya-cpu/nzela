import { describe, expect, it, vi } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import {
  DEFAULT_REFERRAL,
  ReferralEngine,
  referralCode,
  type QualifyingOrder,
} from "./referral.js";
import {
  analyseFunnel,
  classifyLifecycle,
  viralCoefficient,
  winBackTargets,
} from "./funnel.js";

const order = (over: Partial<QualifyingOrder>): QualifyingOrder => ({
  waId: "+243810000099",
  tkRef: "TK-500",
  amountFc: 17000,
  paid: true,
  isFirstPaidOrder: true,
  ...over,
});

function engine(opts: { rewardsEarned?: number; codeOwner?: string } = {}) {
  const ledger = new MemoryLedger();
  const issued: { waId: string; amountFc: number }[] = [];
  const eng = new ReferralEngine(
    DEFAULT_REFERRAL,
    ledger,
    { async issueCredit(waId, amountFc) { issued.push({ waId, amountFc }); } },
    () => opts.codeOwner ?? "+243810000047",
    () => opts.rewardsEarned ?? 0,
  );
  return { eng, ledger, issued };
}

describe("referral codes", () => {
  it("are deterministic and shareable", () => {
    expect(referralCode("+243810000047")).toBe(referralCode("+243810000047"));
    expect(referralCode("+243810000047")).toMatch(/^TK\d{4}.$/);
  });
});

describe("referral rewards — only real paid first orders (abuse-proof)", () => {
  it("rewards both sides when a referred new customer pays their first order", async () => {
    const { eng, issued } = engine();
    const out = await eng.onOrderPaid(order({}), "TK0047A");
    expect(out.rewarded).toBe(true);
    expect(issued).toEqual([
      { waId: "+243810000047", amountFc: 2000 }, // referrer
      { waId: "+243810000099", amountFc: 2000 }, // referee
    ]);
  });

  it("never rewards an unpaid order (no fake-account farming)", async () => {
    const { eng, issued } = engine();
    const out = await eng.onOrderPaid(order({ paid: false }), "TK0047A");
    expect(out).toMatchObject({ rewarded: false, reason: "unpaid" });
    expect(issued).toEqual([]);
  });

  it("never rewards a repeat order (idempotent — can't double-reward)", async () => {
    const { eng } = engine();
    const out = await eng.onOrderPaid(order({ isFirstPaidOrder: false }), "TK0047A");
    expect(out).toMatchObject({ rewarded: false, reason: "not-first-order" });
  });

  it("rejects self-referral and tiny orders", async () => {
    const self = engine({ codeOwner: "+243810000099" });
    expect(await self.eng.onOrderPaid(order({}), "TK0099X")).toMatchObject({ rewarded: false, reason: "self-referral" });
    const small = engine();
    expect(await small.eng.onOrderPaid(order({ amountFc: 1000 }), "TK0047A")).toMatchObject({ rewarded: false, reason: "below-minimum" });
  });

  it("caps rewards per referrer (anti-abuse)", async () => {
    const { eng } = engine({ rewardsEarned: 20 });
    expect(await eng.onOrderPaid(order({}), "TK0047A")).toMatchObject({ rewarded: false, reason: "referrer-cap" });
  });

  it("handles an unknown code gracefully", async () => {
    const ledger = new MemoryLedger();
    const eng = new ReferralEngine(DEFAULT_REFERRAL, ledger,
      { async issueCredit() {} }, () => undefined, () => 0);
    expect(await eng.onOrderPaid(order({}), "TKZZZZZ")).toMatchObject({ rewarded: false, reason: "unknown-referrer" });
  });
});

describe("funnel analytics — answers 'why no customers' with numbers", () => {
  it("finds the biggest leak stage", () => {
    const r = analyseFunnel({ reached: 1000, startedOrder: 400, confirmedOrder: 350, paid: 90, delivered: 85 });
    expect(r.biggestLeak).toBe("confirmToPaid"); // 350→90 is the worst drop
    expect(r.overallConversion).toBeCloseTo(0.085, 3);
  });

  it("computes the viral k-factor", () => {
    const v = viralCoefficient(100, 250, 40);
    expect(v.invitesPerCustomer).toBe(2.5);
    expect(v.inviteConversion).toBeCloseTo(0.16, 3);
    expect(v.k).toBeCloseTo(0.4, 3); // < 1 → still needs top-of-funnel feeding
  });
});

describe("win-back targeting", () => {
  it("classifies lifecycle by recency", () => {
    expect(classifyLifecycle({ waId: "a", lastOrderDaysAgo: 5, totalOrders: 3, creditBalanceFc: 0 })).toBe("active");
    expect(classifyLifecycle({ waId: "a", lastOrderDaysAgo: 20, totalOrders: 3, creditBalanceFc: 0 })).toBe("cooling");
    expect(classifyLifecycle({ waId: "a", lastOrderDaysAgo: 90, totalOrders: 3, creditBalanceFc: 0 })).toBe("churned");
  });

  it("prioritizes recoverable, valuable, credit-holding customers; excludes active", () => {
    const targets = winBackTargets([
      { waId: "active", lastOrderDaysAgo: 3, totalOrders: 10, creditBalanceFc: 0 },
      { waId: "cooling-credit", lastOrderDaysAgo: 20, totalOrders: 8, creditBalanceFc: 2000 },
      { waId: "churned", lastOrderDaysAgo: 100, totalOrders: 1, creditBalanceFc: 0 },
    ]);
    expect(targets.find((t) => t.waId === "active")).toBeUndefined();
    expect(targets[0]!.waId).toBe("cooling-credit"); // highest priority
  });
});
