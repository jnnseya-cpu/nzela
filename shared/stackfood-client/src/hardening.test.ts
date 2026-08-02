import { describe, expect, it, vi } from "vitest";
import { StackFoodClient } from "./client.js";
import { OrderAdapter } from "./order-adapter.js";
import type { PlaceOrderPayload } from "./types.js";

const config = { baseUrl: "https://staging.example/api/v1" };
const noSleep = () => Promise.resolve();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const payload: PlaceOrderPayload = {
  cart: [{ food_id: 1, price: 15000, quantity: 2 }],
  order_amount: 22540,
  payment_method: "cash_on_delivery",
  order_type: "delivery",
  restaurant_id: 17,
  distance: 1.2,
  address: "Bandal",
  latitude: "-4.34",
  longitude: "15.26",
  contact_person_name: "Client",
  contact_person_number: "+243810000047",
  address_type: "home",
  road: "",
  house: "",
  floor: "",
  dm_tips: 0,
  order_note: "NZELA TK-347",
  schedule_at: null,
};

describe("HARDENING: order placement race", () => {
  it("RACE: two concurrent double-taps produce exactly one POST", async () => {
    let posts = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/customer/order/list")) {
        await new Promise((r) => setTimeout(r, 20)); // widen the race window
        return json(200, { orders: [] });
      }
      posts++;
      return json(200, { order_id: 991 });
    });
    const adapter = new OrderAdapter(
      new StackFoodClient(config, fetchMock as never, noSleep),
    );
    const [a, b] = await Promise.all([
      adapter.placeIdempotent(payload, "TK-347", "tok"),
      adapter.placeIdempotent(payload, "TK-347", "tok"),
    ]);
    expect(posts).toBe(1); // pre-fix: 2 — a duplicated real order
    expect(a.orderId).toBe(991);
    expect(b).toEqual({ orderId: 991, recovered: true });
  });

  it("RACE: different orders are not serialized against each other", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/customer/order/list")) return json(200, { orders: [] });
      return json(200, { order_id: Math.floor(Math.random() * 1000) });
    });
    const adapter = new OrderAdapter(
      new StackFoodClient(config, fetchMock as never, noSleep),
    );
    const [a, b] = await Promise.all([
      adapter.placeIdempotent({ ...payload, order_note: "NZELA TK-1" }, "TK-1", "tok"),
      adapter.placeIdempotent({ ...payload, order_note: "NZELA TK-2" }, "TK-2", "tok"),
    ]);
    expect(a.recovered).toBe(false);
    expect(b.recovered).toBe(false);
  });

  it("a failed attempt clears the in-flight slot so retries work", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/customer/order/list")) return json(200, { orders: [] });
      calls++;
      if (calls === 1) return json(400, { error: "rejected" });
      return json(200, { order_id: 992 });
    });
    const adapter = new OrderAdapter(
      new StackFoodClient(config, fetchMock as never, noSleep),
    );
    await expect(
      adapter.placeIdempotent(payload, "TK-347", "tok"),
    ).rejects.toThrow();
    const retry = await adapter.placeIdempotent(payload, "TK-347", "tok");
    expect(retry).toMatchObject({ orderId: 992 });
  });
});
