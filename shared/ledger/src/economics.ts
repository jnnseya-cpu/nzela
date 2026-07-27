/**
 * All-in unit economics — extends the AI/messaging ceilings (§2.3) to the
 * FULL cost stack: AI + WhatsApp + payment-rail fees (mobile money
 * settlement, Stripe/card gateway) + amortized fixed costs (Firebase/GCP,
 * numbers, devices, telephony) — governed by the ×2 RULE: an order only
 * counts as healthy if Tunakula margin ≥ 2 × all-in cost (100% profit
 * over everything). ERRATA E-6.
 *
 * All rates are config, not law: update DEFAULT_COSTS from real invoices
 * monthly; the model and the guard stay the same.
 */

import {
  AI_COST_CEILING_PER_ORDER_USD,
  WA_COST_CEILING_PER_ORDER_USD,
} from "./registry.js";

export type PaymentRail = "cash" | "mobile-money" | "card";

export interface CostModel {
  /** AI spend per order (USD). Use real metered value; cap is the max. */
  aiUsd: number;
  /** WhatsApp templates per order (USD). */
  waUsd: number;
  /** Mobile-money settlement/cash-out cost, as a rate on gross collected. */
  momoSettlementRate: number;
  /** Card gateway (Stripe-class): rate on gross + fixed per transaction. */
  cardRate: number;
  cardFixedUsd: number;
  /**
   * Monthly fixed stack (USD): Firebase/GCP (run + DB + Redis +
   * monitoring), WhatsApp number, telephony, domains, Lipa Box
   * data/devices amortized, and any other standing overhead.
   */
  monthlyFixedUsd: number;
}

/** Planning defaults — replace with invoice reality as it arrives. */
export const DEFAULT_COSTS: CostModel = {
  aiUsd: AI_COST_CEILING_PER_ORDER_USD, // worst case 0.05
  waUsd: WA_COST_CEILING_PER_ORDER_USD, // worst case 0.024
  momoSettlementRate: 0.015, // 1.5% cash-out/settlement, DRC typical
  cardRate: 0.039, // Stripe-class intl card, rest-of-world
  cardFixedUsd: 0.3,
  monthlyFixedUsd: 300, // GCP/Firebase ~200 + numbers/telephony/devices ~100
};

/** Variable (per-order) cost for a given rail and gross amount collected. */
export function variableCostUsd(
  rail: PaymentRail,
  grossCollectedUsd: number,
  c: CostModel = DEFAULT_COSTS,
): number {
  const railFee =
    rail === "mobile-money"
      ? grossCollectedUsd * c.momoSettlementRate
      : rail === "card"
        ? grossCollectedUsd * c.cardRate + c.cardFixedUsd
        : 0; // cash: wewa collects; float handling sits in fixed overhead
  return c.aiUsd + c.waUsd + railFee;
}

/** All-in per-order cost once monthly fixed costs are spread over volume. */
export function allInCostUsd(
  variableUsd: number,
  ordersPerMonth: number,
  c: CostModel = DEFAULT_COSTS,
): number {
  if (ordersPerMonth <= 0) return Infinity;
  return variableUsd + c.monthlyFixedUsd / ordersPerMonth;
}

/** THE ×2 RULE: margin must be ≥ 2 × all-in cost (100% profit). */
export function meetsHundredPercentProfit(
  marginUsd: number,
  allInUsd: number,
): boolean {
  return marginUsd >= 2 * allInUsd;
}

/**
 * Minimum monthly volume for the ×2 rule to hold:
 *   margin ≥ 2·(variable + fixed/N)  ⇒  N ≥ fixed / (margin/2 − variable)
 * Returns Infinity when the rail can NEVER satisfy the rule (variable
 * cost alone eats half the margin) — that is a pricing decision, not a
 * volume problem.
 */
export function breakEvenOrdersPerMonth(
  marginUsd: number,
  variableUsd: number,
  c: CostModel = DEFAULT_COSTS,
): number {
  const headroom = marginUsd / 2 - variableUsd;
  if (headroom <= 0) return Infinity;
  return Math.ceil(c.monthlyFixedUsd / headroom);
}

export interface OrderPnl {
  rail: PaymentRail;
  marginUsd: number;
  variableUsd: number;
  allInUsd: number;
  profitUsd: number;
  profitOverCostPct: number;
  meetsRule: boolean;
}

/** Full per-order P&L at a given monthly volume. */
export function orderPnl(
  rail: PaymentRail,
  marginUsd: number,
  grossCollectedUsd: number,
  ordersPerMonth: number,
  c: CostModel = DEFAULT_COSTS,
): OrderPnl {
  const variable = variableCostUsd(rail, grossCollectedUsd, c);
  const allIn = allInCostUsd(variable, ordersPerMonth, c);
  const profit = marginUsd - allIn;
  return {
    rail,
    marginUsd,
    variableUsd: variable,
    allInUsd: allIn,
    profitUsd: profit,
    profitOverCostPct: allIn > 0 ? (profit / allIn) * 100 : Infinity,
    meetsRule: meetsHundredPercentProfit(marginUsd, allIn),
  };
}
