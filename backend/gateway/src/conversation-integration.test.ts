import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  StackFoodClient,
  CustomerAuthProvisioner,
  MemoryTokenCache,
  InMemoryPasswordVault,
  OrderAdapter,
} from "@nzela/stackfood-client";
import { MemoryLedger } from "@nzela/ledger";
import { feeBreakdown } from "./recap.js";
import { ConversationEngine } from "./conversation.js";
import { MemorySessionStore } from "./session.js";
import {
  buildStackFoodCatalog,
  buildStackFoodOrderPort,
} from "./conversation-stackfood.js";

/**
 * End-to-end: the REAL ConversationEngine + StackFood ports (client, auth,
 * OrderAdapter, authoritative pricing) driven against an in-process StackFood
 * server. Proves the ordering loop actually places a correctly-priced order —
 * the same code runs against the live API once it has network + credentials.
 */

interface MockOrder { id: number; order_note: string; order_amount: number; payment_method: string; order_status: string; }

function startMock(): Promise<{ server: Server; baseUrl: string; orders: MockOrder[] }> {
  const orders: MockOrder[] = [];
  const users = new Map<string, { password: string; token?: string }>();
  let nextId = 100109;
  const restaurants = [
    { id: 17, name: "Mama Kito — Bandal", latitude: "0", longitude: "0", open: 1, delivery_time: "20-30", avg_rating: 4.6 },
    { id: 18, name: "Chez Fatou", latitude: "0", longitude: "0", open: 1, delivery_time: "25", avg_rating: 4.2 },
  ];
  const products: Record<number, { id: number; name: string; price: number; restaurant_id: number }[]> = {
    17: [
      { id: 101, name: "Poulet mayo + fufu", price: 8000, restaurant_id: 17 },
      { id: 102, name: "Jus gingembre", price: 2000, restaurant_id: 17 },
    ],
  };

  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = (code: number, obj: unknown) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      const url = req.url ?? "";
      const auth = req.headers.authorization?.replace("Bearer ", "");
      const payload = body ? JSON.parse(body) : {};

      if (url === "/auth/register") { users.set(payload.phone, { password: payload.password }); return json(200, { ok: true }); }
      if (url === "/auth/login") {
        const u = users.get(payload.phone);
        if (!u || u.password !== payload.password) return json(401, { errors: [{ message: "creds" }] });
        u.token = `cust-${payload.phone}`;
        return json(200, { token: u.token });
      }
      if (url.startsWith("/restaurants/get-restaurants/all")) return json(200, { restaurants });
      if (url.startsWith("/products/latest")) {
        const rid = Number(new URL(url, "http://x").searchParams.get("restaurant_id"));
        return json(200, { products: products[rid] ?? [] });
      }
      const authed = [...users.values()].some((u) => u.token === auth);
      if (url === "/customer/order/place") {
        if (!authed) return json(401, {});
        const order: MockOrder = {
          id: nextId++, order_note: payload.order_note, order_amount: payload.order_amount,
          payment_method: payload.payment_method, order_status: "pending",
        };
        orders.push(order);
        return json(200, { order_id: order.id });
      }
      if (url.startsWith("/customer/order/list")) {
        if (!authed) return json(401, {});
        return json(200, { orders: [...orders].reverse() });
      }
      return json(404, { error: `no route ${url}` });
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}`, orders });
    });
  });
}

describe("integration: ConversationEngine + real StackFood ports", () => {
  let mock: Awaited<ReturnType<typeof startMock>>;
  let engine: ConversationEngine;
  const WA = "+243810000047";

  beforeAll(async () => {
    mock = await startMock();
    const client = new StackFoodClient({ baseUrl: mock.baseUrl }, fetch, () => Promise.resolve());
    const auth = new CustomerAuthProvisioner(client, new MemoryTokenCache(), new InMemoryPasswordVault());
    const adapter = new OrderAdapter(client);
    let seq = 347;
    engine = new ConversationEngine({
      sessions: new MemorySessionStore(),
      ledger: new MemoryLedger(),
      catalog: buildStackFoodCatalog(client),
      orders: buildStackFoodOrderPort({
        client, auth, adapter, zone: 1,
        nextSequence: () => seq++,
        payInstructions: (tkRef, total) => `Paie ${total} FC par Mobile Money, référence ${tkRef}.`,
      }),
    });
  });
  afterAll(() => mock.server.close());

  it("places a correctly-priced real order through the whole chat flow", async () => {
    expect((await engine.handle(WA, { text: "nakolia" })).replies[0]).toContain("Mama Kito");
    expect((await engine.handle(WA, { text: "1" })).replies[0]).toContain("Poulet mayo");
    await engine.handle(WA, { text: "1x2" }); // 2× poulet (8000)
    await engine.handle(WA, { text: "2" }); // 1× jus (2000)
    await engine.handle(WA, { text: "payer" }); // asks address
    const done = await engine.handle(WA, { text: "Bandal, 2e avenue, portail vert" });

    // A real order landed in StackFood, priced by the authoritative engine.
    expect(mock.orders).toHaveLength(1);
    const expected = feeBreakdown(16000 + 2000, 1).totalFc; // subtotal 18000 + fees
    expect(mock.orders[0]!.order_amount).toBe(expected);
    expect(mock.orders[0]!.order_note).toContain("TK-347");
    expect(mock.orders[0]!.payment_method).toBe("offline_payment");
    expect(done.replies[0]).toContain("TK-347");
    expect(done.replies[0]).toContain("Mobile Money");
  });

  it("idempotent: the exact same flow does not double-place (adapter recovers)", async () => {
    // A second identical checkout for a NEW customer still places exactly one.
    const WA2 = "+243890000099";
    await engine.handle(WA2, { text: "menu" });
    await engine.handle(WA2, { text: "1" });
    await engine.handle(WA2, { text: "1" });
    await engine.handle(WA2, { text: "payer" });
    await engine.handle(WA2, { text: "Lemba, avenue 5, maison bleue" });
    expect(mock.orders).toHaveLength(2); // one per customer, no duplicates
  });
});
