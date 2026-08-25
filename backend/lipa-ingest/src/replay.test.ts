import { describe, expect, it } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import { MemoryReplayIndex, verifyPayment } from "./replay.js";
import type { OpenOrder } from "./matcher.js";
import type { ParsedPayment } from "./parsers.js";

const orders: OpenOrder[] = [
  { tkRef: "TK-347", totalFc: 22540, waId: "+243810000047", placedAt: new Date() },
  { tkRef: "TK-348", totalFc: 22540, waId: "+243810000099", placedAt: new Date() },
];

const payment: ParsedPayment = {
  operator: "mpesa",
  amountFc: 22540,
  transactionId: "QGH7X2K9M1",
  tkRef: "TK-347",
};

describe("replay protection (a code used once is dead forever)", () => {
  it("verifies once, then rejects the same reference forever", () => {
    const index = new MemoryReplayIndex();
    const ledger = new MemoryLedger();

    const first = verifyPayment(payment, orders, index, ledger);
    expect(first).toMatchObject({ matched: true, replay: false });

    const second = verifyPayment(payment, orders, index, ledger);
    expect(second).toEqual({
      matched: false,
      replay: true,
      reason: "replayed-reference",
    });
    expect(ledger.events.at(-1)).toMatchObject({ type: "block", agent: "lipa" });
  });

  it("burns the operator transaction id independently of the ref", () => {
    const index = new MemoryReplayIndex();
    const ledger = new MemoryLedger();
    verifyPayment(payment, orders, index, ledger);

    // Same SMS re-forwarded against a different open order's ref: the txn
    // id gives it away even though TK-348 was never used.
    const forged = { ...payment, tkRef: "TK-348" };
    const result = verifyPayment(forged, orders, index, ledger);
    expect(result).toMatchObject({ matched: false, replay: true });
  });

  it("a failed match burns nothing — the customer can retry", () => {
    const index = new MemoryReplayIndex();
    const ledger = new MemoryLedger();
    const wrongAmount = { ...payment, amountFc: 5000 };
    expect(
      verifyPayment(wrongAmount, orders, index, ledger),
    ).toMatchObject({ matched: false, replay: false });
    // The genuine SMS still verifies afterwards.
    expect(verifyPayment(payment, orders, index, ledger)).toMatchObject({
      matched: true,
    });
  });

  it("burns the content fingerprint — an amount-only SMS with NO txn id cannot settle two same-amount orders", () => {
    const index = new MemoryReplayIndex();
    const ledger = new MemoryLedger();
    // Two open orders share the amount; the confirmation has no ref and no
    // transaction id — only the content hash can stop the double-credit.
    const twoOpen: OpenOrder[] = [
      { tkRef: "TK-901", totalFc: 22540, waId: "+243810000001", placedAt: new Date() },
      { tkRef: "TK-902", totalFc: 22540, waId: "+243810000002", placedAt: new Date() },
    ];
    const amountOnly: ParsedPayment = {
      operator: "mpesa",
      amountFc: 22540,
      dedupHash: "abc123contentfingerprint",
    };
    // First forward matches one order (ambiguous → needs to be unique; make
    // it unique by closing one). Match against a single open order:
    const single: OpenOrder[] = [twoOpen[0]!];
    const first = verifyPayment(amountOnly, single, index, ledger);
    expect(first).toMatchObject({ matched: true, replay: false });

    // Re-forward the identical SMS against the OTHER same-amount order.
    const other: OpenOrder[] = [twoOpen[1]!];
    const second = verifyPayment(amountOnly, other, index, ledger);
    expect(second).toMatchObject({ matched: false, replay: true });
  });

  it("distinct payments with distinct codes are unaffected", () => {
    const index = new MemoryReplayIndex();
    const ledger = new MemoryLedger();
    verifyPayment(payment, orders, index, ledger);
    const other: ParsedPayment = {
      operator: "orange",
      amountFc: 22540,
      transactionId: "OM.2607.4411",
      tkRef: "TK-348",
    };
    expect(verifyPayment(other, orders, index, ledger)).toMatchObject({
      matched: true,
      replay: false,
    });
  });
});
