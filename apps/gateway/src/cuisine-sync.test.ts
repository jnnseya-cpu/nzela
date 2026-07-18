import { describe, expect, it } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import {
  applyKitchenEvent,
  InvalidKitchenTransition,
  TTS_ESCALATION_COST_USD,
  type KitchenOrder,
} from "./cuisine-sync.js";

const fresh = (): KitchenOrder => ({
  tkRef: "TK-347",
  state: "awaiting-vendor",
  restaurantId: 17,
});

describe("Cuisine Sync state machine (FR-K1..K3)", () => {
  it("happy path: vendor accepts with a prep time", () => {
    const order = applyKitchenEvent(
      fresh(),
      { type: "vendor-accepted", prepTimeMin: 25 },
      new MemoryLedger(),
    );
    expect(order).toMatchObject({ state: "accepted", prepTimeMin: 25 });
  });

  it("60 s silence → TTS voice call at $0.008 (FR-K2)", () => {
    const ledger = new MemoryLedger();
    const order = applyKitchenEvent(fresh(), { type: "timeout" }, ledger);
    expect(order.state).toBe("escalating-voice-call");
    expect(ledger.events[0]).toMatchObject({
      type: "ai",
      agent: "cuisine-sync",
      costUsd: TTS_ESCALATION_COST_USD,
    });
  });

  it("voice call answered with DTMF acceptance recovers the order", () => {
    const ledger = new MemoryLedger();
    let order = applyKitchenEvent(fresh(), { type: "timeout" }, ledger);
    order = applyKitchenEvent(
      order,
      { type: "voice-call-answered", accepted: true, prepTimeMin: 30 },
      ledger,
    );
    expect(order).toMatchObject({ state: "accepted", prepTimeMin: 30 });
  });

  it("full failure exposes both branches: reroute and instant credit (FR-K3)", () => {
    const ledger = new MemoryLedger();
    let order = applyKitchenEvent(fresh(), { type: "timeout" }, ledger);
    order = applyKitchenEvent(order, { type: "voice-call-unanswered" }, ledger);
    expect(order.state).toBe("vendor-failed");

    const rerouted = applyKitchenEvent(
      order,
      { type: "customer-chose-reroute", substituteRestaurantId: 21 },
      ledger,
    );
    expect(rerouted).toMatchObject({ state: "rerouted", restaurantId: 21 });

    const refunded = applyKitchenEvent(
      order,
      { type: "customer-chose-refund" },
      ledger,
    );
    expect(refunded.state).toBe("refunded");
  });

  it("rejects impossible transitions", () => {
    expect(() =>
      applyKitchenEvent(
        { ...fresh(), state: "accepted" },
        { type: "timeout" },
        new MemoryLedger(),
      ),
    ).toThrow(InvalidKitchenTransition);
  });
});
