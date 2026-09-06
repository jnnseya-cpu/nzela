import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configFromEnv } from "./config.js";
import { buildServices } from "./bootstrap.js";

/**
 * End-to-end proof that the bootstrap composes a RUNNING two-service system:
 * a WhatsApp conversation places a real (mocked-transport) StackFood order,
 * the open-order book records it, an SMS payment verifies through lipa, and
 * the customer is notified — all wired by `buildServices`, no globals, no
 * network. This is the "does it actually run as one thing" test that was
 * missing.
 */

// Minimal StackFood mock covering the endpoints the order loop touches.
const stackfoodMock = (async (url: any, init: any) => {
  const u = String(url);
  const j = (obj: unknown) =>
    new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });
  if (u.includes("/restaurants/get-restaurants/all")) {
    return j({ restaurants: [{ id: 1, name: "Chez Mama", delivery_time: "30", latitude: "0", longitude: "0" }] });
  }
  if (u.includes("/products/latest")) {
    return j({ products: [{ id: 100, name: "Poulet Mayo", price: 8000 }] });
  }
  if (u.includes("/auth/login")) return j({ token: "cust-token" });
  if (u.includes("/customer/order/place")) return j({ order_id: 555 });
  if (u.includes("/customer/order/list")) return j({ orders: [] });
  return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
}) as unknown as typeof fetch;

const sent: { waId: string; body: string }[] = [];
let dir: string;
let gateway: Server;
let lipa: Server;
let gBase: string;
let lBase: string;

const post = (base: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });

const inbound = (from: string, text: string) => ({
  entry: [{ changes: [{ value: { messages: [{ from, type: "text", text: { body: text } }] } }] }],
});

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "nzela-boot-"));
  const config = configFromEnv({
    DATA_DIR: dir,
    LIPA_INGEST_TOKEN: "lipa-tok",
    STACKFOOD_BASE_URL: "https://stackfood.test/api/v1",
    MERCHANT_MPESA: "+243810000000",
    DELIVERY_ZONE: "1",
    // No WA_APP_SECRET → inbound signature check disabled for the test.
    // No WA creds → sender would be console; we inject a capturing one.
  });
  const built = buildServices(config, {
    fetchImpl: stackfoodMock,
    sender: { async sendText(waId, body) { sent.push({ waId, body }); } },
    env: {}, // analytics inert
  });
  gateway = built.gateway;
  lipa = built.lipa;
  (globalThis as any).__openOrders = built.openOrders;
  await new Promise<void>((r) => gateway.listen(0, "127.0.0.1", r));
  await new Promise<void>((r) => lipa.listen(0, "127.0.0.1", r));
  const ga = gateway.address();
  const la = lipa.address();
  if (typeof ga === "object" && ga) gBase = `http://127.0.0.1:${ga.port}`;
  if (typeof la === "object" && la) lBase = `http://127.0.0.1:${la.port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => gateway.close(() => r()));
  await new Promise<void>((r) => lipa.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});

describe("buildServices — full order → payment → notification loop", () => {
  const cust = "243810000123";

  it("places an order through a WhatsApp conversation on the real ports", async () => {
    for (const step of ["nakolia", "1", "1", "payer", "Bandal, 2e avenue, portail vert"]) {
      const res = await post(gBase, "/wa/webhook", inbound(cust, step));
      expect(res.status).toBe(200);
    }
    const openOrders = (globalThis as any).__openOrders as import("./open-orders.js").OpenOrderBook;
    const open = openOrders.open();
    expect(open).toHaveLength(1);
    expect(open[0]!.waId).toBe(`+${cust}`);
    expect(open[0]!.totalFc).toBeGreaterThan(8000); // subtotal + fees + delivery
    // Customer received the récap with the pay instruction + TK ref.
    const recap = sent.at(-1)!.body;
    expect(recap).toContain(open[0]!.tkRef);
    expect(recap).toContain("M-Pesa");
  });

  it("verifies a mobile-money SMS and notifies the customer 'paiement reçu'", async () => {
    const openOrders = (globalThis as any).__openOrders as import("./open-orders.js").OpenOrderBook;
    const order = openOrders.open()[0]!;
    const before = sent.length;
    const smsBody = `M-Pesa. Vous avez recu ${order.totalFc} FC de +243812223344. Ref ${order.tkRef}`;
    const res = await post(
      lBase,
      "/lipa/sms",
      { from: "M-PESA", body: smsBody },
      { "X-Lipa-Token": "lipa-tok" },
    );
    const verdict = (await res.json()) as { verdict: string; tkRef?: string };
    expect(verdict.verdict).toBe("verified");
    expect(verdict.tkRef).toBe(order.tkRef);
    // Order flipped to paid, customer told.
    expect(openOrders.open()).toHaveLength(0);
    expect(sent.length).toBe(before + 1);
    expect(sent.at(-1)!.waId).toBe(order.waId);
    expect(sent.at(-1)!.body).toContain("Paiement reçu");
  });

  it("rejects a lipa SMS with a bad ingest token", async () => {
    const res = await post(lBase, "/lipa/sms", { from: "M-PESA", body: "x" }, { "X-Lipa-Token": "wrong" });
    expect(res.status).toBe(401);
  });
});
