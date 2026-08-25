import { describe, it, expect } from "vitest";
import {
  priceOrder,
  verifyPayloadPricing,
  PricingError,
  MAX_LINE_QTY,
  type PriceBook,
} from "./pricing.js";

// Authoritative menu — the ONLY source of prices.
const MENU: Record<number, number> = { 101: 8000, 102: 5000 };
const ADDONS: Record<number, number> = { 9: 500, 8: 1000 };
const book: PriceBook = {
  product: (id) => (id in MENU ? { price: MENU[id]! } : undefined),
  addOn: (id) => (id in ADDONS ? { price: ADDONS[id]! } : undefined),
};

describe("priceOrder — server-authoritative pricing", () => {
  it("prices from the menu, ignoring any caller-supplied price", () => {
    const q = priceOrder([{ food_id: 101, quantity: 2 }], book, 1);
    expect(q.subtotalFc).toBe(16000); // 8000 × 2 from the MENU
    expect(q.lines[0]!.price).toBe(8000); // server price
    // fees: 10% service + 2% processing + zone-1 delivery, total derived
    expect(q.orderAmount).toBe(q.fees.totalFc);
    expect(q.orderAmount).toBeGreaterThan(q.subtotalFc);
  });

  it("includes add-ons at menu prices", () => {
    const q = priceOrder(
      [{ food_id: 102, quantity: 1, add_ons: [9, 8], add_on_qtys: [2, 1] }],
      book,
      1,
    );
    // 5000 + (500×2 + 1000×1) = 7000
    expect(q.subtotalFc).toBe(7000);
  });

  it("rejects an unknown food_id (fail closed — never price at 0)", () => {
    expect(() => priceOrder([{ food_id: 999, quantity: 1 }], book, 1)).toThrow(PricingError);
  });

  it("rejects non-positive, fractional and oversized quantities", () => {
    expect(() => priceOrder([{ food_id: 101, quantity: 0 }], book, 1)).toThrow(PricingError);
    expect(() => priceOrder([{ food_id: 101, quantity: -3 }], book, 1)).toThrow(PricingError);
    expect(() => priceOrder([{ food_id: 101, quantity: 1.5 }], book, 1)).toThrow(PricingError);
    expect(() => priceOrder([{ food_id: 101, quantity: MAX_LINE_QTY + 1 }], book, 1)).toThrow(PricingError);
  });

  it("rejects an empty cart", () => {
    expect(() => priceOrder([], book, 1)).toThrow(PricingError);
  });

  it("rejects mismatched add_on_qtys length", () => {
    expect(() =>
      priceOrder([{ food_id: 101, quantity: 1, add_ons: [9, 8], add_on_qtys: [1] }], book, 1),
    ).toThrow(PricingError);
  });
});

describe("verifyPayloadPricing — tamper guard", () => {
  const good = priceOrder([{ food_id: 101, quantity: 2 }], book, 1);
  const basePayload = { cart: good.lines, order_amount: good.orderAmount };

  it("accepts an authoritative payload", () => {
    expect(() => verifyPayloadPricing(basePayload, book, 1)).not.toThrow();
  });

  it("rejects a lowered line price", () => {
    const tampered = {
      cart: [{ ...good.lines[0]!, price: 1 }],
      order_amount: good.orderAmount,
    };
    expect(() => verifyPayloadPricing(tampered, book, 1)).toThrow(PricingError);
  });

  it("rejects a lowered order_amount (pay-less-for-real-goods)", () => {
    const tampered = { cart: good.lines, order_amount: 100 };
    expect(() => verifyPayloadPricing(tampered, book, 1)).toThrow(PricingError);
  });
});
