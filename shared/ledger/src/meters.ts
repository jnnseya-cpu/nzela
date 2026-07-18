import {
  AI_COST_CEILING_PER_ORDER_USD,
  WA_COST_CEILING_PER_ORDER_USD,
  WA_UTILITY_TEMPLATE_USD,
} from "./registry.js";
import type { LedgerEvent } from "./types.js";

/**
 * Per-order cost meters — FR-M4 and the ops-console "Compteur". AI spend and
 * WhatsApp messaging spend are metered separately against their pilot
 * ceilings ($0.05 and $0.024 per order).
 */

export type WaMessageClass =
  /** Customer-initiated service window — always free (FR-M1). */
  | "customer-service-window"
  /** Paid utility template to resto/wewa outside their window (FR-M2). */
  | "utility-template"
  /** Message inside a window reopened by a resto/wewa button tap — free. */
  | "reopened-window";

export function waMessageCostUsd(cls: WaMessageClass): number {
  return cls === "utility-template" ? WA_UTILITY_TEMPLATE_USD : 0;
}

export interface OrderCostSummary {
  tkRef: string;
  aiUsd: number;
  waUsd: number;
  aiCalls: number;
  deterministicSteps: number;
  blockedLlmCalls: number;
  withinAiCeiling: boolean;
  withinWaCeiling: boolean;
}

export function summarizeOrderCosts(
  tkRef: string,
  events: readonly LedgerEvent[],
): OrderCostSummary {
  const forOrder = events.filter((e) => e.tkRef === tkRef);
  const aiUsd = forOrder
    .filter((e) => e.type === "ai")
    .reduce((s, e) => s + e.costUsd, 0);
  const waUsd = forOrder
    .filter((e) => e.type === "wa-message")
    .reduce((s, e) => s + e.costUsd, 0);
  return {
    tkRef,
    aiUsd,
    waUsd,
    aiCalls: forOrder.filter((e) => e.type === "ai").length,
    deterministicSteps: forOrder.filter((e) => e.type === "deterministic")
      .length,
    blockedLlmCalls: forOrder.filter((e) => e.type === "block").length,
    withinAiCeiling: aiUsd <= AI_COST_CEILING_PER_ORDER_USD,
    withinWaCeiling: waUsd <= WA_COST_CEILING_PER_ORDER_USD,
  };
}
