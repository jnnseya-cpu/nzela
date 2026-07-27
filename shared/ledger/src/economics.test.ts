import { describe, expect, it } from "vitest";
import {
  allInCostUsd,
  breakEvenOrdersPerMonth,
  DEFAULT_COSTS,
  meetsHundredPercentProfit,
  orderPnl,
  variableCostUsd,
} from "./economics.js";

/** §8 reference basket: margin $1.10, customer total $8.05. */
const MARGIN = 1.1;
const GROSS = 8.05;

describe("all-in unit economics (×2 rule — ERRATA E-6)", () => {
  it("prices each payment rail's variable cost", () => {
    expect(variableCostUsd("cash", GROSS)).toBeCloseTo(0.074, 3); // AI+WA only
    expect(variableCostUsd("mobile-money", GROSS)).toBeCloseTo(0.195, 3);
    expect(variableCostUsd("card", GROSS)).toBeCloseTo(0.688, 3);
  });

  it("card orders can NEVER meet the ×2 rule at reference basket — pricing decision needed", () => {
    // variable 0.688 > margin/2 (0.55): no volume fixes this.
    expect(
      breakEvenOrdersPerMonth(MARGIN, variableCostUsd("card", GROSS)),
    ).toBe(Infinity);
  });

  it("computes the break-even volume for momo and cash", () => {
    // momo: 300 / (0.55 − 0.19475) = 845 orders/month ≈ 29/day
    expect(
      breakEvenOrdersPerMonth(MARGIN, variableCostUsd("mobile-money", GROSS)),
    ).toBe(845);
    // cash: 300 / (0.55 − 0.074) = 631 orders/month ≈ 21/day
    expect(breakEvenOrdersPerMonth(MARGIN, variableCostUsd("cash", GROSS))).toBe(
      631,
    );
  });

  it("full P&L: momo order at 1 000 orders/month meets the rule", () => {
    const pnl = orderPnl("mobile-money", MARGIN, GROSS, 1000);
    expect(pnl.allInUsd).toBeCloseTo(0.495, 3); // 0.195 + 300/1000
    expect(pnl.meetsRule).toBe(true);
    expect(pnl.profitUsd).toBeGreaterThan(0.6);
    expect(pnl.profitOverCostPct).toBeGreaterThan(100);
  });

  it("full P&L: the same order at 200 orders/month fails the rule (fixed costs dominate)", () => {
    const pnl = orderPnl("mobile-money", MARGIN, GROSS, 200);
    expect(pnl.allInUsd).toBeCloseTo(1.695, 3); // fixed 1.50/order
    expect(pnl.meetsRule).toBe(false);
    expect(pnl.profitUsd).toBeLessThan(0); // actually loss-making all-in
  });

  it("guard semantics: exactly 2× passes, below fails", () => {
    expect(meetsHundredPercentProfit(1.0, 0.5)).toBe(true);
    expect(meetsHundredPercentProfit(0.99, 0.5)).toBe(false);
  });

  it("zero volume yields infinite all-in cost", () => {
    expect(allInCostUsd(0.2, 0)).toBe(Infinity);
  });

  it("planning defaults stay explicit so invoices can replace them", () => {
    expect(DEFAULT_COSTS.monthlyFixedUsd).toBe(300);
    expect(DEFAULT_COSTS.cardRate).toBeCloseTo(0.039);
  });
});

describe("config/costs.json — the ops-editable model", () => {
  it("the committed config parses and currently matches the defaults", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const raw = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../../config/costs.json", import.meta.url)),
        "utf8",
      ),
    );
    const { parseCostModel } = await import("./economics.js");
    expect(parseCostModel(raw)).toEqual(DEFAULT_COSTS);
  });

  it("a partial or corrupt update never zeroes a cost line", async () => {
    const { parseCostModel } = await import("./economics.js");
    const model = parseCostModel({ monthlyFixedUsd: 412, cardRate: "oops", aiUsd: -1 });
    expect(model.monthlyFixedUsd).toBe(412); // real invoice value taken
    expect(model.cardRate).toBeCloseTo(0.039); // bad value → default kept
    expect(model.aiUsd).toBe(0.05); // negative rejected → default kept
  });
});
