import { describe, it, expect } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import { dispatch, GREETING, type DispatchDeps } from "./dispatch.js";
import type { WhatsAppSender } from "./server.js";

function harness(over: Partial<DispatchDeps> = {}) {
  const sent: { waId: string; body: string }[] = [];
  const sender: WhatsAppSender = {
    async sendText(waId, body) {
      sent.push({ waId, body });
    },
  };
  const deps: DispatchDeps = { sender, ledger: new MemoryLedger(), ...over };
  return { deps, sent };
}

describe("dispatch — every decision gets a reply", () => {
  it("sends a greeting", async () => {
    const { deps, sent } = harness();
    const r = await dispatch({ kind: "deterministic", action: "greeting" }, "+243810000047", deps);
    expect(sent[0]!.body).toBe(GREETING);
    expect(r.sent.length).toBe(1);
  });

  it("lists restaurants from the provider", async () => {
    const { deps, sent } = harness({
      restaurantsNear: async () => [
        { name: "Mama Kito", etaMin: 20 },
        { name: "Chez Fatou" },
      ],
    });
    await dispatch({ kind: "deterministic", action: "show-restaurants" }, "+243810000047", deps);
    expect(sent[0]!.body).toContain("Mama Kito");
    expect(sent[0]!.body).toContain("Chez Fatou");
    expect(sent[0]!.body).toContain("~20 min");
  });

  it("falls back to a safe reply when a provider is absent", async () => {
    const { deps, sent } = harness();
    await dispatch({ kind: "deterministic", action: "show-cart" }, "+243810000047", deps);
    expect(sent[0]!.body).toContain("panier est vide");
  });

  it("shows the checkout récap and fires an InitiateCheckout analytics event", async () => {
    const events: string[] = [];
    const analytics = {
      emit: async (e: { name: string }) => {
        events.push(e.name);
        return [];
      },
      sinkNames: [],
    } as unknown as DispatchDeps["analytics"];
    const { deps, sent } = harness({
      checkoutRecap: async () => "Total: 22 540 FC",
      analytics,
    });
    await dispatch({ kind: "deterministic", action: "checkout" }, "+243810000047", deps);
    expect(sent[0]!.body).toContain("22 540 FC");
    expect(events).toEqual(["InitiateCheckout"]);
  });

  it("uses the Commande agent when wired, else a deterministic nudge", async () => {
    const withAgent = harness({ commandeAgent: async () => "Deux poulets mayo, c'est noté." });
    await dispatch({ kind: "agent-commande", text: "2 poulets mayo" }, "+243810000047", withAgent.deps);
    expect(withAgent.sent[0]!.body).toContain("c'est noté");

    const noAgent = harness();
    await dispatch({ kind: "agent-commande", text: "2 poulets mayo" }, "+243810000047", noAgent.deps);
    expect(noAgent.sent[0]!.body).toContain("Restos");
  });

  it("degrades to the fallback when an agent throws (never breaks the loop)", async () => {
    const { deps, sent } = harness({
      adresseAgent: async () => {
        throw new Error("LLM down");
      },
    });
    await dispatch({ kind: "agent-adresse", text: "Bandal portail vert" }, "+243810000047", deps);
    expect(sent[0]!.body).toContain("repères");
  });

  it("still sends firewall blocks", async () => {
    const { deps, sent } = harness();
    await dispatch({ kind: "firewall-block", reply: "on parle nourriture 😄" }, "+243810000047", deps);
    expect(sent[0]!.body).toContain("nourriture");
  });

  it("never throws when the sender itself fails", async () => {
    const badSender: WhatsAppSender = {
      async sendText() {
        throw new Error("network");
      },
    };
    const r = await dispatch(
      { kind: "deterministic", action: "greeting" },
      "+243810000047",
      { sender: badSender, ledger: new MemoryLedger() },
    );
    expect(r.sent.length).toBe(0); // nothing recorded as sent, but no throw
  });
});
