import type {
  PlaceOrderPayload,
  Product,
  Restaurant,
  StackFoodConfig,
  OrderStatusUpdate,
} from "./types.js";

/**
 * StackFood REST client — the Order Adapter's transport (Integration Spec
 * §1, §8). Stateless; auth tokens are injected per call. Non-functional
 * contract: 5 s connect / 10 s read timeouts, 3 retries with exponential
 * backoff (1 s / 3 s / 9 s) on 5xx and network errors only — never retry a
 * 4xx.
 */

const RETRY_DELAYS_MS = [1_000, 3_000, 9_000];

export class StackFoodHttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    body: string,
  ) {
    super(`StackFood ${status} on ${path}: ${body.slice(0, 200)}`);
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  token?: string;
  body?: unknown;
  /** Extra headers, e.g. zoneId on catalog endpoints. */
  headers?: Record<string, string>;
}

/** Injectable for tests; defaults to global fetch. */
export type FetchLike = typeof fetch;

export class StackFoodClient {
  private readonly readTimeoutMs: number;

  constructor(
    private readonly config: StackFoodConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {
    this.readTimeoutMs = config.readTimeoutMs ?? 10_000;
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...opts.headers,
    };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (this.config.zoneIds) {
      headers.zoneId = JSON.stringify(this.config.zoneIds);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const res = await this.fetchImpl(url, {
          method: opts.method ?? "GET",
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: AbortSignal.timeout(this.readTimeoutMs),
        });
        if (res.ok) return (await res.json()) as T;
        const body = await res.text();
        const error = new StackFoodHttpError(res.status, path, body);
        if (res.status >= 500 && attempt < RETRY_DELAYS_MS.length) {
          lastError = error;
        } else {
          throw error; // 4xx: never retry
        }
      } catch (err) {
        if (err instanceof StackFoodHttpError) throw err;
        // Network/timeout error — retryable.
        if (attempt >= RETRY_DELAYS_MS.length) throw err;
        lastError = err;
      }
      await this.sleep(RETRY_DELAYS_MS[attempt]!);
    }
    throw lastError;
  }

  // ---- Flow 1: catalog (read-only, cache in front of these) ----

  getZoneId(lat: number, lng: number): Promise<{ zone_id: string }> {
    return this.request(`/config/get-zone-id?lat=${lat}&lng=${lng}`);
  }

  getRestaurants(offset = 1, limit = 50): Promise<{ restaurants: Restaurant[] }> {
    return this.request(
      `/restaurants/get-restaurants/all?offset=${offset}&limit=${limit}`,
    );
  }

  getLatestProducts(
    restaurantId: number,
    offset = 1,
    limit = 100,
  ): Promise<{ products: Product[] }> {
    return this.request(
      `/products/latest?restaurant_id=${restaurantId}&offset=${offset}&limit=${limit}`,
    );
  }

  /**
   * Backs the Commande Agent: after LLM extraction, each item is resolved to a
   * product_id here — never trust the LLM with IDs.
   */
  searchProducts(
    name: string,
    restaurantId?: number,
  ): Promise<{ products: Product[] }> {
    const rid = restaurantId ? `&restaurant_id=${restaurantId}` : "";
    return this.request(
      `/products/search?name=${encodeURIComponent(name)}${rid}`,
    );
  }

  // ---- Flow 3: order placement ----

  placeOrder(
    payload: PlaceOrderPayload,
    customerToken: string,
  ): Promise<{ order_id: number }> {
    return this.request(`/customer/order/place`, {
      method: "POST",
      token: customerToken,
      body: payload,
    });
  }

  // ---- Flow 5: status updates (WhatsApp buttons → API) ----

  vendorUpdateStatus(update: OrderStatusUpdate, vendorToken: string) {
    return this.request(`/vendor/order/update-status`, {
      method: "POST",
      token: vendorToken,
      body: update,
    });
  }

  dmAcceptOrder(orderId: number, dmToken: string) {
    return this.request(`/delivery-man/accept-order`, {
      method: "POST",
      token: dmToken,
      body: { order_id: orderId },
    });
  }

  dmUpdateStatus(update: OrderStatusUpdate, dmToken: string) {
    return this.request(`/delivery-man/update-order-status`, {
      method: "POST",
      token: dmToken,
      body: update,
    });
  }

  // ---- Flow 4: wallet bridge (Pattern B) ----

  adminWalletAddFund(
    fund: { customer_id: number; amount: number; reference: string },
    adminToken: string,
  ) {
    return this.request(`/admin/customer/wallet/add-fund`, {
      method: "POST",
      token: adminToken,
      body: fund,
    });
  }
}
