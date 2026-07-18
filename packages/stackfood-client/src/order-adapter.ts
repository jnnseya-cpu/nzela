import type { StackFoodClient } from "./client.js";
import type { PlaceOrderPayload } from "./types.js";

/**
 * Idempotent order placement — Integration Spec §5. The transport layer
 * already retries 5xx/network errors, but a lost response leaves the
 * outcome ambiguous: the order may or may not exist in StackFood. Per the
 * spec, the Adapter then checks `GET /customer/order/list` for a matching
 * `order_note` before re-posting. Never double-place.
 */

export interface CustomerOrderSummary {
  id: number;
  order_note?: string;
}

export interface PlacementResult {
  orderId: number;
  /** True when the order was found pre-existing rather than newly posted. */
  recovered: boolean;
}

export class OrderAdapter {
  constructor(private readonly client: StackFoodClient) {}

  /**
   * Place the order carrying `tkRef` in its order_note. On a thrown
   * transport error, look for an existing order with the same TK ref before
   * surfacing the failure — if StackFood recorded it, return that order.
   */
  async placeIdempotent(
    payload: PlaceOrderPayload,
    tkRef: string,
    customerToken: string,
  ): Promise<PlacementResult> {
    if (!payload.order_note.includes(tkRef)) {
      throw new Error(
        `order_note must carry the TK ref ${tkRef} (join-key invariant)`,
      );
    }

    // Check-before-write: a previous ambiguous attempt may have landed.
    const existing = await this.findByTkRef(tkRef, customerToken);
    if (existing) return { orderId: existing.id, recovered: true };

    try {
      const res = await this.client.placeOrder(payload, customerToken);
      return { orderId: res.order_id, recovered: false };
    } catch (err) {
      const landed = await this.findByTkRef(tkRef, customerToken).catch(
        () => undefined,
      );
      if (landed) return { orderId: landed.id, recovered: true };
      throw err;
    }
  }

  private async findByTkRef(
    tkRef: string,
    customerToken: string,
  ): Promise<CustomerOrderSummary | undefined> {
    const res = await this.client.request<{ orders: CustomerOrderSummary[] }>(
      `/customer/order/list?offset=1&limit=5`,
      { token: customerToken },
    );
    return res.orders.find((o) => o.order_note?.includes(tkRef));
  }
}
