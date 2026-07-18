import { describe, expect, it } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import { parseSms } from "./parsers.js";
import { matchPayment, needsEscalation, type OpenOrder } from "./matcher.js";

describe("SMS Ledger Bridge parsing (FR-P1)", () => {
  it("parses an M-Pesa confirmation with TK ref", () => {
    const p = parseSms(
      "QGH7X2K9M1 Confirme. Vous avez reçu 22.540 FC de +243810000047. Ref: TK-347. Nouveau solde 145.000 FC.",
      "M-PESA",
    );
    expect(p).toMatchObject({
      operator: "mpesa",
      amountFc: 22540,
      transactionId: "QGH7X2K9M1",
      tkRef: "TK-347",
    });
  });

  it("parses Orange Money / Airtel / Africell formats", () => {
    expect(
      parseSms(
        "Orange Money: vous avez recu 5 000 FC de +243890000012. Trans ID: OM.2607.4411. Motif: TK-52",
      ),
    ).toMatchObject({ operator: "orange", amountFc: 5000, tkRef: "TK-52" });
    expect(
      parseSms(
        "Airtel Money. Recu 7 000 FC de +243990000033 Ref: PP260718.1902.C11 TK-88",
      ),
    ).toMatchObject({ operator: "airtel", amountFc: 7000, tkRef: "TK-88" });
    expect(
      parseSms("Afrimoney: recu 3 500 FC de +243900000044 Txn: AF99231 TK-101"),
    ).toMatchObject({ operator: "africell", amountFc: 3500, tkRef: "TK-101" });
  });

  it("returns undefined for non-payment SMS", () => {
    expect(parseSms("Votre forfait internet expire demain")).toBeUndefined();
  });
});

describe("payment ↔ order matching (FR-P1/P4)", () => {
  const orders: OpenOrder[] = [
    { tkRef: "TK-347", totalFc: 22540, waId: "+243810000047", placedAt: new Date() },
    { tkRef: "TK-348", totalFc: 9840, waId: "+243810000099", placedAt: new Date() },
  ];

  it("matches on TK ref + amount", () => {
    const ledger = new MemoryLedger();
    const result = matchPayment(
      { operator: "mpesa", amountFc: 22540, tkRef: "TK-347" },
      orders,
      ledger,
    );
    expect(result).toMatchObject({ matched: true, exact: true });
    expect(ledger.events[0]).toMatchObject({ agent: "lipa", costUsd: 0.0002 });
  });

  it("flags amount mismatches instead of force-matching", () => {
    const result = matchPayment(
      { operator: "mpesa", amountFc: 10000, tkRef: "TK-347" },
      orders,
      new MemoryLedger(),
    );
    expect(result).toMatchObject({ matched: false, reason: "amount-mismatch" });
  });

  it("falls back to a unique exact amount when the customer forgot the ref", () => {
    const result = matchPayment(
      { operator: "orange", amountFc: 9840 },
      orders,
      new MemoryLedger(),
    );
    expect(result).toMatchObject({ matched: true, exact: false });
  });

  it("escalates unmatched payments after 3 minutes (FR-P4)", () => {
    const t0 = new Date("2026-07-18T19:00:00Z");
    expect(needsEscalation(t0, new Date("2026-07-18T19:02:59Z"))).toBe(false);
    expect(needsEscalation(t0, new Date("2026-07-18T19:03:00Z"))).toBe(true);
  });
});
