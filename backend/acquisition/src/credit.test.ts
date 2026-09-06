import { describe, expect, it, vi } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import { StackFoodCreditIssuer } from "./credit.js";
import { ReferralEngine, DEFAULT_REFERRAL } from "./referral.js";

function fakeClient() {
  const calls: { customer_id: number; amount: number; reference: string }[] = [];
  const client = {
    async adminWalletAddFund(fund: any, _token: string) {
      calls.push(fund);
      return { ok: true } as any;
    },
  } as any;
  return { client, calls };
}

describe("StackFoodCreditIssuer", () => {
  it("credits the resolved customer wallet with the FC amount + reason", async () => {
    const { client, calls } = fakeClient();
    const issuer = new StackFoodCreditIssuer({
      client,
      resolveCustomerId: async (waId) => (waId === "+243810000001" ? 42 : undefined),
      adminToken: async () => "admin-token",
    });
    await issuer.issueCredit("+243810000001", 2000, "parrainage TK-9");
    expect(calls).toEqual([{ customer_id: 42, amount: 2000, reference: "parrainage TK-9" }]);
  });

  it("throws (does not silently drop) when the customer can't be resolved", async () => {
    const { client } = fakeClient();
    const issuer = new StackFoodCreditIssuer({
      client,
      resolveCustomerId: async () => undefined,
      adminToken: async () => "t",
    });
    await expect(issuer.issueCredit("+243999", 2000, "x")).rejects.toThrow(/customer_id/);
  });

  it("refuses a non-positive credit", async () => {
    const { client, calls } = fakeClient();
    const issuer = new StackFoodCreditIssuer({
      client,
      resolveCustomerId: async () => 1,
      adminToken: async () => "t",
    });
    await expect(issuer.issueCredit("+243", 0, "x")).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("plugs into ReferralEngine — a settled first order credits both wallets", async () => {
    const { client, calls } = fakeClient();
    const ledger = new MemoryLedger();
    const issuer = new StackFoodCreditIssuer({
      client,
      resolveCustomerId: async (waId) => (waId === "+243ref" ? 7 : 9),
      adminToken: async () => "t",
    });
    const engine = new ReferralEngine(
      DEFAULT_REFERRAL,
      ledger,
      issuer,
      (code) => (code === "TK1234A" ? "+243ref" : undefined),
      () => 0,
    );
    const outcome = await engine.onOrderPaid(
      { waId: "+243new", tkRef: "TK-100", amountFc: 8000, paid: true, isFirstPaidOrder: true, settled: true },
      "TK1234A",
    );
    expect(outcome.rewarded).toBe(true);
    // referrer (id 7) + referee (id 9) both credited.
    expect(calls.map((c) => c.customer_id).sort()).toEqual([7, 9]);
  });
});
