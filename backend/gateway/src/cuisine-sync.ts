import type { LedgerSink } from "@nzela/ledger";

/**
 * Cuisine Sync — agent #5 (FR-K1..K4): the restaurant order state machine
 * and the "paid but restaurant silent" exception ladder. Deterministic
 * except the TTS escalation call ($0.008, the agent's entire budget).
 *
 * 60 s without a response → automated voice call. Full failure → the
 * customer instantly gets BOTH branches: reroute to the nearest
 * category-matched restaurant, or one-tap full refund to Crédit Tunakula
 * (wallet credit — zero money movement, Integration Spec §6 Pattern B).
 */

export const VENDOR_RESPONSE_TIMEOUT_MS = 60_000;
export const TTS_ESCALATION_COST_USD = 0.008;

export type KitchenState =
  | "awaiting-vendor"
  | "escalating-voice-call"
  | "vendor-failed"
  | "accepted"
  | "rejected"
  | "rerouted"
  | "refunded";

export type KitchenEvent =
  | { type: "vendor-accepted"; prepTimeMin: number }
  | { type: "vendor-rejected"; reason: string }
  | { type: "timeout" }
  | { type: "voice-call-answered"; accepted: boolean; prepTimeMin?: number }
  | { type: "voice-call-unanswered" }
  | { type: "customer-chose-reroute"; substituteRestaurantId: number }
  | { type: "customer-chose-refund" };

export interface KitchenOrder {
  tkRef: string;
  state: KitchenState;
  restaurantId: number;
  prepTimeMin?: number;
}

export class InvalidKitchenTransition extends Error {
  constructor(state: KitchenState, event: KitchenEvent["type"]) {
    super(`Cannot apply ${event} in state ${state}`);
  }
}

export function applyKitchenEvent(
  order: KitchenOrder,
  event: KitchenEvent,
  ledger: LedgerSink,
): KitchenOrder {
  const log = (
    purpose: string,
    type: "deterministic" | "ai" | "lifecycle" = "lifecycle",
    costUsd = 0,
  ) =>
    ledger.write({
      type,
      agent: "cuisine-sync",
      purpose,
      costUsd,
      tkRef: order.tkRef,
      at: new Date(),
    });

  switch (event.type) {
    case "vendor-accepted":
      if (
        order.state !== "awaiting-vendor" &&
        order.state !== "escalating-voice-call"
      ) {
        throw new InvalidKitchenTransition(order.state, event.type);
      }
      log(`vendor accepted — prêt en ${event.prepTimeMin} min`);
      return { ...order, state: "accepted", prepTimeMin: event.prepTimeMin };

    case "vendor-rejected":
      if (order.state !== "awaiting-vendor") {
        throw new InvalidKitchenTransition(order.state, event.type);
      }
      log(`vendor rejected: ${event.reason}`);
      return { ...order, state: "rejected" };

    case "timeout":
      if (order.state !== "awaiting-vendor") {
        throw new InvalidKitchenTransition(order.state, event.type);
      }
      // FR-K2: 60 s silence → automated TTS voice call, budget $0.008.
      log("60 s sans réponse → appel vocal automatisé", "ai", TTS_ESCALATION_COST_USD);
      return { ...order, state: "escalating-voice-call" };

    case "voice-call-answered":
      if (order.state !== "escalating-voice-call") {
        throw new InvalidKitchenTransition(order.state, event.type);
      }
      if (event.accepted) {
        log(`voice call: accepted (DTMF), prêt en ${event.prepTimeMin ?? 25} min`);
        return {
          ...order,
          state: "accepted",
          prepTimeMin: event.prepTimeMin ?? 25,
        };
      }
      log("voice call: vendor declined");
      return { ...order, state: "vendor-failed" };

    case "voice-call-unanswered":
      if (order.state !== "escalating-voice-call") {
        throw new InvalidKitchenTransition(order.state, event.type);
      }
      // FR-K3: full failure — customer instantly gets both branches.
      log("appel sans réponse → resto injoignable, branches reroute/crédit");
      return { ...order, state: "vendor-failed" };

    case "customer-chose-reroute":
      if (order.state !== "vendor-failed" && order.state !== "rejected") {
        throw new InvalidKitchenTransition(order.state, event.type);
      }
      log(`reroute vers resto ${event.substituteRestaurantId}`);
      return {
        ...order,
        state: "rerouted",
        restaurantId: event.substituteRestaurantId,
      };

    case "customer-chose-refund":
      if (order.state !== "vendor-failed" && order.state !== "rejected") {
        throw new InvalidKitchenTransition(order.state, event.type);
      }
      // Crédit Tunakula: wallet credit, zero money movement (FR-P3).
      log("remboursement instantané → Crédit Tunakula");
      return { ...order, state: "refunded" };
  }
}
