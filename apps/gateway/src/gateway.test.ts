import { describe, expect, it } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import { FIREWALL_REPLY, Router } from "./router.js";
import { feeBreakdown, renderRecap } from "./recap.js";
import { renderMilestone, STATUS_MILESTONES, UTILITY_TEMPLATES } from "./status-mapping.js";
import { signWebhook, verifyWebhookSignature } from "./webhook.js";

describe("Router + AI firewall (FR-A2/FR-A3)", () => {
  it("routes button taps deterministically at zero tokens", () => {
    const ledger = new MemoryLedger();
    const router = new Router(ledger);
    const decision = router.route(
      { waId: "+243810000047", buttonId: "btn_restos" },
      "idle",
    );
    expect(decision).toEqual({
      kind: "deterministic",
      action: "show-restaurants",
    });
    expect(ledger.events[0]).toMatchObject({ type: "deterministic", costUsd: 0 });
  });

  it("routes food-shaped free text to the Commande Agent", () => {
    const router = new Router(new MemoryLedger());
    const decision = router.route(
      { waId: "x", text: "2 poulets mayo et un jus" },
      "idle",
    );
    expect(decision).toEqual({
      kind: "agent-commande",
      text: "2 poulets mayo et un jus",
    });
  });

  it("firewalls off-topic content with a canned redirect and logs the block", () => {
    const ledger = new MemoryLedger();
    const router = new Router(ledger);
    const decision = router.route(
      { waId: "x", text: "tu penses quoi des élections?" },
      "idle",
    );
    expect(decision).toEqual({ kind: "firewall-block", reply: FIREWALL_REPLY });
    expect(ledger.events[0]).toMatchObject({ type: "block", agent: "router" });
  });

  it("routes address-phase free text and voice to the Adresse Agent", () => {
    const router = new Router(new MemoryLedger());
    expect(
      router.route(
        { waId: "x", text: "Bandal, après Sainte-Anne, portail vert" },
        "awaiting-address",
      ).kind,
    ).toBe("agent-adresse");
    expect(
      router.route({ waId: "x", isVoiceNote: true }, "awaiting-address").kind,
    ).toBe("agent-adresse");
    expect(router.route({ waId: "x", isVoiceNote: true }, "ordering").kind).toBe(
      "agent-commande",
    );
  });
});

describe("order economics (§8 — locked)", () => {
  it("reproduces the reference basket exactly", () => {
    const b = feeBreakdown(17000, 1);
    expect(b.serviceFc).toBe(1700);
    expect(b.processingFc).toBe(340);
    expect(b.deliveryFc).toBe(3500);
    expect(b.totalFc).toBe(22540);
    expect(b.wewaShareFc).toBe(2450);
    expect(b.margeFc).toBe(3090);
  });

  it("shows the full breakdown before payment (FR-E2)", () => {
    const recap = renderRecap(feeBreakdown(17000, 1));
    for (const line of ["17 000 FC", "1 700 FC", "340 FC", "3 500 FC", "22 540 FC"]) {
      expect(recap.replace(/ /g, " ")).toContain(line);
    }
  });
});

describe("status → milestone mapping (FR-S3)", () => {
  it("covers every StackFood status with free customer messaging", () => {
    const statuses = Object.keys(STATUS_MILESTONES);
    expect(statuses).toHaveLength(9);
    for (const m of Object.values(STATUS_MILESTONES)) {
      expect(m.paid).toBe(false); // customer window is always free (FR-M1)
    }
  });

  it("interpolates template variables", () => {
    expect(
      renderMilestone("confirmed", { resto: "Mama Kito", eta: "19:40" }),
    ).toBe("👩🏾‍🍳 Mama Kito a accepté — prête vers 19:40");
  });

  it("declares the six Meta utility templates (FR-M3)", () => {
    expect(UTILITY_TEMPLATES).toHaveLength(6);
  });
});

describe("webhook HMAC (FR-S2)", () => {
  it("accepts a valid signature and rejects tampering", () => {
    const body = JSON.stringify({ event: "order.status_changed", order_id: 9 });
    const sig = signWebhook(body, "shared-secret");
    expect(verifyWebhookSignature(body, sig, "shared-secret")).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, "shared-secret")).toBe(false);
    expect(verifyWebhookSignature(body, sig, "wrong-secret")).toBe(false);
    expect(verifyWebhookSignature(body, "zz-not-hex", "shared-secret")).toBe(false);
  });
});
