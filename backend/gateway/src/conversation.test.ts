import { describe, it, expect } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import { ConversationEngine, type CatalogPort, type OrderPort } from "./conversation.js";
import { MemorySessionStore, type Session } from "./session.js";

const catalog: CatalogPort = {
  async restaurants() {
    return [
      { id: 17, name: "Mama Kito — Bandal", etaMin: 20 },
      { id: 18, name: "Chez Fatou" },
    ];
  },
  async menu(id) {
    if (id !== 17) return [];
    return [
      { food_id: 101, name: "Poulet mayo + fufu", price: 8000 },
      { food_id: 102, name: "Jus gingembre", price: 2000 },
    ];
  },
};

function makeEngine() {
  const placedWith: Session[] = [];
  const orders: OrderPort = {
    async place(session) {
      placedWith.push(structuredClone(session));
      return { tkRef: "TK-347", orderId: 100109, recap: "🧾 Commande TK-347 · Total 22 540 FC · paie par Mobile Money" };
    },
    async status() {
      return "Commande n° 100109 — statut: en cuisine.";
    },
  };
  const engine = new ConversationEngine({
    sessions: new MemorySessionStore(),
    catalog,
    orders,
    ledger: new MemoryLedger(),
  });
  return { engine, placedWith };
}

const WA = "+243810000047";

describe("ConversationEngine — full order happy path", () => {
  it("walks restaurants → menu → cart → address → placement", async () => {
    const { engine, placedWith } = makeEngine();

    const r1 = await engine.handle(WA, { text: "nakolia" });
    expect(r1.replies[0]).toContain("Mama Kito");
    expect(r1.replies[0]).toContain("1.");

    const r2 = await engine.handle(WA, { text: "1" });
    expect(r2.replies[0]).toContain("Menu — Mama Kito");
    expect(r2.replies[0]).toContain("Poulet mayo");

    const r3 = await engine.handle(WA, { text: "1x2" });
    expect(r3.replies[0]).toContain("Ajouté");
    expect(r3.replies[0]).toContain("2× Poulet mayo");

    const r4 = await engine.handle(WA, { text: "2" });
    expect(r4.replies[0]).toContain("Jus gingembre");

    const r5 = await engine.handle(WA, { text: "payer" });
    expect(r5.replies[0]).toContain("adresse"); // asks for address first

    const r6 = await engine.handle(WA, { text: "Bandal, 2e avenue, après l'église, portail vert" });
    expect(r6.replies[0]).toContain("TK-347");

    // The order the engine placed carried the real cart + address.
    expect(placedWith.length).toBe(1);
    const placed = placedWith[0]!;
    expect(placed.cart).toEqual([
      { food_id: 101, name: "Poulet mayo + fufu", price: 8000, quantity: 2 },
      { food_id: 102, name: "Jus gingembre", price: 2000, quantity: 1 },
    ]);
    expect(placed.addressText).toContain("portail vert");

    const r7 = await engine.handle(WA, { text: "statut" });
    expect(r7.replies[0]).toContain("en cuisine");
  });

  it("rejects an out-of-range selection instead of guessing", async () => {
    const { engine } = makeEngine();
    await engine.handle(WA, { text: "menu" });
    const r = await engine.handle(WA, { text: "9" }); // only 2 restos
    expect(r.replies[0]).toContain("numéro du resto");
  });

  it("firewalls off-topic chatter", async () => {
    const { engine } = makeEngine();
    const r = await engine.handle("+243999999999", { text: "parle-moi de politique" });
    expect(r.replies[0]).toContain("nourriture");
  });

  it("greets a hello", async () => {
    const { engine } = makeEngine();
    const r = await engine.handle("+243888888888", { text: "bonjour" });
    expect(r.replies[0]).toContain("Mama Tunakula");
  });

  it("resets from any phase with «annuler»", async () => {
    const { engine } = makeEngine();
    await engine.handle(WA, { text: "nakolia" });
    const r = await engine.handle(WA, { text: "annuler" });
    expect(r.replies[0]).toContain("zéro");
  });

  it("does not place an empty cart", async () => {
    const { engine, placedWith } = makeEngine();
    await engine.handle(WA, { text: "nakolia" });
    await engine.handle(WA, { text: "1" }); // menu, cart still empty
    const r = await engine.handle(WA, { text: "payer" });
    expect(r.replies[0]).toContain("panier est vide");
    expect(placedWith.length).toBe(0);
  });
});
