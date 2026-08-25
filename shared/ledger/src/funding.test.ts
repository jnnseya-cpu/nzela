import { describe, it, expect } from "vitest";
import { InMemoryAcuWallet } from "./acu.js";
import { MemoryLedger } from "./types.js";
import {
  MemoryFundingLedger,
  fundAcuTopUp,
  grantSubscriptionPeriod,
  acuForUsd,
} from "./funding.js";

describe("ACU top-up funding", () => {
  it("credits floored ACU for a paid amount (1 ACU = $0.001)", () => {
    expect(acuForUsd(5)).toBe(5000);
    expect(acuForUsd(0.0015)).toBe(1); // floored, never over-credits
  });

  it("credits once and is idempotent on a replayed funding txn", () => {
    const wallet = new InMemoryAcuWallet();
    const funding = new MemoryFundingLedger();
    const audit = new MemoryLedger();
    const args = { account: "cust:+243810000047", fundingTxnId: "MPX-9001", usdPaid: 5 };

    const first = fundAcuTopUp(wallet, funding, args, audit);
    expect(first).toEqual({ credited: 5000, duplicate: false });
    expect(wallet.balance("cust:+243810000047")).toBe(5000);

    const replay = fundAcuTopUp(wallet, funding, args, audit);
    expect(replay).toEqual({ credited: 0, duplicate: true });
    expect(wallet.balance("cust:+243810000047")).toBe(5000); // NOT doubled
  });

  it("rejects invalid amounts (no free / negative / NaN top-up)", () => {
    const wallet = new InMemoryAcuWallet();
    const funding = new MemoryFundingLedger();
    const audit = new MemoryLedger();
    const base = { account: "a", fundingTxnId: "T1" };
    expect(() => fundAcuTopUp(wallet, funding, { ...base, usdPaid: 0 }, audit)).toThrow(RangeError);
    expect(() => fundAcuTopUp(wallet, funding, { ...base, usdPaid: -5 }, audit)).toThrow(RangeError);
    expect(() => fundAcuTopUp(wallet, funding, { ...base, usdPaid: NaN }, audit)).toThrow(RangeError);
    expect(() => fundAcuTopUp(wallet, funding, { account: "a", fundingTxnId: "", usdPaid: 5 }, audit)).toThrow(RangeError);
    expect(wallet.balance("a")).toBe(0);
  });
});

describe("subscription period grant", () => {
  it("grants a period once and blocks a double-grant / free extension", () => {
    const funding = new MemoryFundingLedger();
    const audit = new MemoryLedger();
    const args = { account: "cust:x", planId: "pro", periodKey: "2026-09" };

    expect(grantSubscriptionPeriod(funding, args, audit)).toEqual({ granted: true, duplicate: false });
    expect(grantSubscriptionPeriod(funding, args, audit)).toEqual({ granted: false, duplicate: true });
    // A NEW period is a fresh grant (requires its own settled charge upstream).
    expect(
      grantSubscriptionPeriod(funding, { ...args, periodKey: "2026-10" }, audit),
    ).toEqual({ granted: true, duplicate: false });
  });

  it("requires account, plan and period", () => {
    const funding = new MemoryFundingLedger();
    const audit = new MemoryLedger();
    expect(() => grantSubscriptionPeriod(funding, { account: "", planId: "pro", periodKey: "p" }, audit)).toThrow(RangeError);
    expect(() => grantSubscriptionPeriod(funding, { account: "a", planId: "", periodKey: "p" }, audit)).toThrow(RangeError);
    expect(() => grantSubscriptionPeriod(funding, { account: "a", planId: "pro", periodKey: "" }, audit)).toThrow(RangeError);
  });
});
