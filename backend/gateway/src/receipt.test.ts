import { describe, expect, it } from "vitest";
import { feeBreakdown } from "./recap.js";
import {
  assertCustomerSafe,
  renderCustomerReceipt,
  totalFc,
  type OrderReceipt,
} from "./receipt.js";

const receipt: OrderReceipt = {
  stackfoodOrderId: 100109,
  tkRef: "TK-347",
  placedAt: new Date("2026-07-18T18:20:00Z"),
  restaurantName: "Mama Kito — Bandal",
  orderType: "delivery",
  status: "delivered",
  paymentMethod: "offline_payment",
  paymentStatus: "paid",
  cutlery: false,
  items: [
    {
      name: "Poulet mayo + fufu",
      quantity: 2,
      unitPriceFc: 15000,
      addons: [{ name: "Fufu supplémentaire", quantity: 1, unitPriceFc: 1000 }],
    },
    { name: "Jus gingembre", quantity: 1, unitPriceFc: 2000 },
  ],
  fees: feeBreakdown(33000, 1),
};

describe("customer receipt (StackFood order-details mirror)", () => {
  it("shows the fields a customer must see", () => {
    const text = renderCustomerReceipt(receipt);
    for (const expected of [
      "TK-347",
      "100109",
      "Mama Kito — Bandal",
      "Livraison",
      "Livrée",
      "Mobile Money",
      "payé",
      "Couverts: Non",
      "2× Poulet mayo + fufu — 30 000 FC",
      "+ 1× Fufu supplémentaire — 1 000 FC",
      "1× Jus gingembre — 2 000 FC",
      "Frais de service (10%)",
      "Frais de traitement (2%)",
      "Livraison: 3 500 FC",
    ]) {
      expect(text.replace(/ | /g, " ")).toContain(expected);
    }
  });

  it("totals items + addons + fees − discounts", () => {
    // 32 000 items + 1 000 addon + 3 300 svc + 660 proc + 3 500 delivery
    expect(totalFc(receipt)).toBe(40460);
    expect(totalFc({ ...receipt, discountFc: 500, dmTipsFc: 1000 })).toBe(
      40960,
    );
  });

  it("shows unpaid cash orders as à payer", () => {
    const text = renderCustomerReceipt({
      ...receipt,
      paymentMethod: "cash_on_delivery",
      paymentStatus: "unpaid",
    });
    expect(text).toContain("Cash à la livraison — à payer");
  });

  it("never leaks ops-ledger economics to the customer (FR-W4)", () => {
    const text = renderCustomerReceipt(receipt);
    expect(() => assertCustomerSafe(text)).not.toThrow();
    for (const leaked of ["Marge", "Coût IA", "Couverture", "LLM", "70%"]) {
      expect(text).not.toContain(leaked);
    }
    // And the guard itself catches a bilan-style message.
    expect(() =>
      assertCustomerSafe("Marge Tunakula: $2.09 · Couverture ×80"),
    ).toThrow(/ops-only/);
  });
});

describe("receipt total — money-safety guards", () => {
  const base: OrderReceipt = {
    ...receipt,
    items: [{ name: "Item", quantity: 1, unitPriceFc: 10000 }],
    fees: feeBreakdown(10000, 1),
  };

  it("never goes negative when a discount exceeds the gross (we never pay the customer)", () => {
    const t = totalFc({ ...base, discountFc: 999999 });
    expect(t).toBe(0);
  });

  it("rejects a negative discount or coupon (would inflate the charge)", () => {
    expect(() => totalFc({ ...base, discountFc: -5000 })).toThrow();
    expect(() => totalFc({ ...base, couponFc: -1 })).toThrow();
  });

  it("applies a valid discount normally", () => {
    const full = totalFc(base);
    expect(totalFc({ ...base, discountFc: 1000 })).toBe(full - 1000);
  });
});
