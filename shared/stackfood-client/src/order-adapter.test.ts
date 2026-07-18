import { describe, expect, it, vi } from "vitest";
import { StackFoodClient } from "./client.js";
import { OrderAdapter } from "./order-adapter.js";
import {
  CustomerAuthProvisioner,
  emailForWaId,
  MemoryTokenCache,
} from "./auth.js";
import type { PlaceOrderPayload } from "./types.js";

const config = { baseUrl: "https://staging.tunakula.com/api/v1" };
const noSleep = () => Promise.resolve();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const payload: PlaceOrderPayload = {
  cart: [{ food_id: 1042, price: 15000, quantity: 2 }],
  order_amount: 22540,
  payment_method: "cash_on_delivery",
  order_type: "delivery",
  restaurant_id: 17,
  distance: 1.2,
  address: "Bandal, après Sainte-Anne, portail vert",
  latitude: "-4.3419",
  longitude: "15.2663",
  contact_person_name: "Client WA",
  contact_person_number: "+243810000047",
  address_type: "home",
  road: "",
  house: "",
  floor: "",
  dm_tips: 0,
  order_note: "NZELA TK-347",
  schedule_at: null,
};

describe("OrderAdapter idempotent placement (Integration Spec §5)", () => {
  it("places normally when no matching order exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, { orders: [] }))
      .mockResolvedValueOnce(json(200, { order_id: 991 }));
    const adapter = new OrderAdapter(
      new StackFoodClient(config, fetchMock, noSleep),
    );
    const result = await adapter.placeIdempotent(payload, "TK-347", "tok");
    expect(result).toEqual({ orderId: 991, recovered: false });
  });

  it("recovers an already-landed order instead of double-placing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(200, { orders: [{ id: 880, order_note: "NZELA TK-347" }] }),
      );
    const adapter = new OrderAdapter(
      new StackFoodClient(config, fetchMock, noSleep),
    );
    const result = await adapter.placeIdempotent(payload, "TK-347", "tok");
    expect(result).toEqual({ orderId: 880, recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no POST issued
  });

  it("checks the order list after an ambiguous transport failure", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/customer/order/list")) {
        // First check: empty. Post-failure check: the order landed.
        return fetchMock.mock.calls.filter(([u]) =>
          (u as string).includes("/customer/order/list"),
        ).length <= 1
          ? Promise.resolve(json(200, { orders: [] }))
          : Promise.resolve(
              json(200, { orders: [{ id: 992, order_note: "NZELA TK-347" }] }),
            );
      }
      return Promise.reject(new Error("socket hang up"));
    });
    const adapter = new OrderAdapter(
      new StackFoodClient(config, fetchMock as never, noSleep),
    );
    const result = await adapter.placeIdempotent(payload, "TK-347", "tok");
    expect(result).toEqual({ orderId: 992, recovered: true });
  });

  it("rejects an order_note missing the TK ref", async () => {
    const adapter = new OrderAdapter(
      new StackFoodClient(config, vi.fn(), noSleep),
    );
    await expect(
      adapter.placeIdempotent(
        { ...payload, order_note: "sans piment" },
        "TK-347",
        "tok",
      ),
    ).rejects.toThrow("join-key invariant");
  });
});

describe("CustomerAuthProvisioner (Integration Spec §2)", () => {
  const vault = { passwordFor: async () => "vault-secret" };

  it("derives the synthetic email from the wa_id", () => {
    expect(emailForWaId("+243810000047")).toBe(
      "243810000047@wa.tunakula.com",
    );
  });

  it("registers then logs in on first contact, and caches the token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: "unknown account" })) // login
      .mockResolvedValueOnce(json(200, { ok: true })) // register
      .mockResolvedValueOnce(json(200, { token: "tok-fresh" })); // login
    const cache = new MemoryTokenCache();
    const auth = new CustomerAuthProvisioner(
      new StackFoodClient(config, fetchMock, noSleep),
      cache,
      vault,
    );
    expect(await auth.tokenFor("+243810000047")).toBe("tok-fresh");
    // Warm cache: no further HTTP.
    expect(await auth.tokenFor("+243810000047")).toBe("tok-fresh");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const registerCall = fetchMock.mock.calls[1]!;
    expect(registerCall[0]).toContain("/auth/register");
    expect(JSON.parse(registerCall[1].body).email).toBe(
      "243810000047@wa.tunakula.com",
    );
  });

  it("logs in directly for an existing account", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, { token: "tok-existing" }));
    const auth = new CustomerAuthProvisioner(
      new StackFoodClient(config, fetchMock, noSleep),
      new MemoryTokenCache(),
      vault,
    );
    expect(await auth.tokenFor("+243810000047")).toBe("tok-existing");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("invalidate() drops the cached token so the next call re-authenticates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(200, { token: "tok-2" }));
    const cache = new MemoryTokenCache();
    const auth = new CustomerAuthProvisioner(
      new StackFoodClient(config, fetchMock, noSleep),
      cache,
      vault,
    );
    await cache.set("token:cust:+243810000047", "tok-stale");
    await auth.invalidate("+243810000047");
    expect(await auth.tokenFor("+243810000047")).toBe("tok-2");
  });
});
