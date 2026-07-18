import { describe, expect, it, vi } from "vitest";
import { StackFoodClient, StackFoodHttpError } from "./client.js";

const config = { baseUrl: "https://staging.tunakula.com/api/v1", zoneIds: [1] };
const noSleep = () => Promise.resolve();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("StackFoodClient retry contract (Integration Spec §8)", () => {
  it("retries 5xx up to 3 times then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: "boom" }))
      .mockResolvedValueOnce(jsonResponse(502, { error: "boom" }))
      .mockResolvedValueOnce(jsonResponse(200, { zone_id: "[1]" }));
    const client = new StackFoodClient(config, fetchMock, noSleep);
    const result = await client.getZoneId(-4.34, 15.26);
    expect(result).toEqual({ zone_id: "[1]" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never retries a 4xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: "unauthenticated" }));
    const client = new StackFoodClient(config, fetchMock, noSleep);
    await expect(client.getRestaurants()).rejects.toBeInstanceOf(
      StackFoodHttpError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends zoneId header and bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { order_id: 991 }));
    const client = new StackFoodClient(config, fetchMock, noSleep);
    await client.placeOrder(
      {
        cart: [],
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
        road: "2e avenue",
        house: "portail vert",
        floor: "",
        dm_tips: 0,
        order_note: "NZELA TK-347",
        schedule_at: null,
      },
      "tok-abc",
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${config.baseUrl}/customer/order/place`);
    expect(init.headers.Authorization).toBe("Bearer tok-abc");
    expect(init.headers.zoneId).toBe("[1]");
    expect(JSON.parse(init.body).order_note).toContain("TK-347");
  });
});
