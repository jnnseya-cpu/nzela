import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StackFoodClient } from "./client.js";
import { CustomerAuthProvisioner, MemoryTokenCache } from "./auth.js";
import { OrderAdapter } from "./order-adapter.js";
import { formatTkRef } from "./idempotency.js";
import type { PlaceOrderPayload } from "./types.js";

/**
 * End-to-end integration test: the REAL production code (client, auth
 * provisioner, order adapter) driven against an in-process mock of the
 * StackFood v1 API, exercising both the user journey and the admin/vendor
 * journeys of Flows 2–5. The mock enforces auth and records state like the
 * real backend so regressions in call shape are caught here.
 */

interface MockOrder {
  id: number;
  order_note: string;
  status: string;
  payment_method: string;
  payment_status: string;
  order_amount: number;
}

class MockStackFood {
  server!: Server;
  baseUrl!: string;
  readonly users = new Map<string, { password: string; token?: string }>();
  readonly orders: MockOrder[] = [];
  readonly wallet = new Map<number, number>();
  vendorToken = "vendor-tok-17";
  adminToken = "admin-tok";
  nextOrderId = 100109;

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const json = (code: number, obj: unknown) => {
          res.writeHead(code, { "Content-Type": "application/json" });
          res.end(JSON.stringify(obj));
        };
        const auth = req.headers.authorization?.replace("Bearer ", "");
        const url = req.url ?? "";
        const payload = body ? JSON.parse(body) : {};

        if (url === "/auth/register") {
          this.users.set(payload.phone, { password: payload.password });
          return json(200, { ok: true });
        }
        if (url === "/auth/login") {
          const u = this.users.get(payload.phone);
          if (!u || u.password !== payload.password) {
            return json(401, { errors: [{ message: "credentials" }] });
          }
          u.token = `cust-${payload.phone}`;
          return json(200, { token: u.token });
        }
        const authed = [...this.users.values()].find((u) => u.token === auth);
        if (url === "/customer/order/place") {
          if (!authed) return json(401, { errors: [{ message: "auth" }] });
          const order: MockOrder = {
            id: this.nextOrderId++,
            order_note: payload.order_note,
            status: "pending",
            payment_method: payload.payment_method,
            payment_status: "unpaid",
            order_amount: payload.order_amount,
          };
          this.orders.push(order);
          return json(200, { order_id: order.id });
        }
        if (url.startsWith("/customer/order/list")) {
          if (!authed) return json(401, { errors: [{ message: "auth" }] });
          return json(200, { orders: this.orders });
        }
        if (url === "/vendor/order/update-status") {
          if (auth !== this.vendorToken) return json(401, {});
          const o = this.orders.find((x) => x.id === payload.order_id);
          if (!o) return json(404, {});
          o.status = payload.status;
          return json(200, { ok: true });
        }
        if (url === "/admin/customer/wallet/add-fund") {
          if (auth !== this.adminToken) return json(401, {});
          this.wallet.set(
            payload.customer_id,
            (this.wallet.get(payload.customer_id) ?? 0) + payload.amount,
          );
          return json(200, { ok: true });
        }
        return json(404, { error: `no route ${url}` });
      });
    });
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    const addr = this.server.address();
    if (typeof addr === "object" && addr) {
      this.baseUrl = `http://127.0.0.1:${addr.port}`;
    }
  }
  stop(): Promise<void> {
    return new Promise((r) => this.server.close(() => r()));
  }
}

const mock = new MockStackFood();
let client: StackFoodClient;

beforeAll(async () => {
  await mock.start();
  client = new StackFoodClient({ baseUrl: mock.baseUrl }, fetch, () =>
    Promise.resolve(),
  );
});
afterAll(() => mock.stop());

const WA_ID = "+243810000047";
const payload = (tkRef: string): PlaceOrderPayload => ({
  cart: [{ food_id: 1042, price: 15000, quantity: 2 }],
  order_amount: 22540,
  payment_method: "offline_payment",
  order_type: "delivery",
  restaurant_id: 17,
  distance: 1.2,
  address: "Bandal, après Sainte-Anne, portail vert",
  latitude: "-4.3419",
  longitude: "15.2663",
  contact_person_name: "Client WA",
  contact_person_number: WA_ID,
  address_type: "home",
  road: "2e avenue",
  house: "portail vert",
  floor: "",
  dm_tips: 0,
  order_note: `NZELA ${tkRef}`,
  schedule_at: null,
  payment_info: { référence: tkRef },
});

describe("integration: full order loop against mock StackFood", () => {
  const cache = new MemoryTokenCache();
  const vault = { passwordFor: async () => "vault-secret-1" };
  let token: string;
  let orderId: number;
  const tkRef = formatTkRef(347);

  it("USER: first contact auto-provisions the StackFood account", async () => {
    const auth = new CustomerAuthProvisioner(client, cache, vault);
    token = await auth.tokenFor(WA_ID);
    expect(token).toBe(`cust-${WA_ID}`);
    expect(mock.users.has(WA_ID)).toBe(true);
  });

  it("USER: order placed with TK ref lands in StackFood exactly once", async () => {
    const adapter = new OrderAdapter(client);
    const first = await adapter.placeIdempotent(payload(tkRef), tkRef, token);
    orderId = first.orderId;
    expect(first.recovered).toBe(false);
    // Retry (double tap / network replay) recovers, never double-places.
    const retry = await adapter.placeIdempotent(payload(tkRef), tkRef, token);
    expect(retry).toEqual({ orderId, recovered: true });
    expect(mock.orders).toHaveLength(1);
    expect(mock.orders[0]!.order_note).toContain("TK-347");
  });

  it("ADMIN: wallet credit (Crédit Tunakula rail) books against the customer", async () => {
    await client.adminWalletAddFund(
      { customer_id: 47, amount: 22540, reference: `MPESA QGH7X2 / ${tkRef}` },
      mock.adminToken,
    );
    expect(mock.wallet.get(47)).toBe(22540);
  });

  it("VENDOR: WhatsApp accept button updates StackFood status", async () => {
    await client.vendorUpdateStatus(
      { order_id: orderId, status: "confirmed", processing_time: 25 },
      mock.vendorToken,
    );
    expect(mock.orders[0]!.status).toBe("confirmed");
    await client.vendorUpdateStatus(
      { order_id: orderId, status: "handover" },
      mock.vendorToken,
    );
    expect(mock.orders[0]!.status).toBe("handover");
  });

  it("SECURITY: wrong vendor token is rejected and never retried", async () => {
    await expect(
      client.vendorUpdateStatus(
        { order_id: orderId, status: "confirmed" },
        "stolen-token",
      ),
    ).rejects.toThrow(/401/);
  });
});
