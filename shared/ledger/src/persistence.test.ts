import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileAcuWallet, FileFundingLedger } from "./persistence.js";
import { MemoryLedger } from "./types.js";
import { fundAcuTopUp } from "./funding.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "nzela-ledger-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("FileAcuWallet — durable balance across restart", () => {
  it("keeps the balance after a simulated restart", () => {
    const path = join(dir, "acu.json");
    const w1 = new FileAcuWallet(path);
    w1.topUp("acct", 5000);
    const res = w1.reserve("acct", 50);
    w1.commit("acct", res.reserved, 50);
    expect(w1.balance("acct")).toBe(4950);

    // restart
    const w2 = new FileAcuWallet(path);
    expect(w2.balance("acct")).toBe(4950);
  });

  it("carries the same guards (rejects bad top-up, clamps double-settle)", () => {
    const path = join(dir, "acu2.json");
    const w = new FileAcuWallet(path);
    expect(() => w.topUp("a", -1)).toThrow(RangeError);
    w.topUp("a", 100);
    const r = w.reserve("a", 40);
    w.release("a", r.reserved);
    w.release("a", r.reserved); // stray double release
    expect(w.balance("a")).toBe(100); // not inflated
  });
});

describe("FileFundingLedger — durable idempotency across restart", () => {
  it("a top-up funded before a restart is NOT re-credited after it", () => {
    const walletPath = join(dir, "w.json");
    const fundingPath = join(dir, "f.json");
    const audit = new MemoryLedger();
    const args = { account: "cust:x", fundingTxnId: "TXN-1", usdPaid: 5 };

    const first = fundAcuTopUp(
      new FileAcuWallet(walletPath),
      new FileFundingLedger(fundingPath),
      args,
      audit,
    );
    expect(first).toEqual({ credited: 5000, duplicate: false });

    // restart: fresh wallet + funding ledger from the same files
    const replay = fundAcuTopUp(
      new FileAcuWallet(walletPath),
      new FileFundingLedger(fundingPath),
      args,
      audit,
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.credited).toBe(0);
    // balance still 5000, not 10000
    expect(new FileAcuWallet(walletPath).balance("cust:x")).toBe(5000);
  });
});
