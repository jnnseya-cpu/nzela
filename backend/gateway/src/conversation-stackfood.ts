import {
  StackFoodClient,
  CustomerAuthProvisioner,
  OrderAdapter,
  formatTkRef,
  type PlaceOrderPayload,
} from "@nzela/stackfood-client";
import type { DeliveryZone } from "@nzela/landmark-graph";
import { feeBreakdown } from "./recap.js";
import { priceOrder, type PriceBook, type QuoteLine } from "./pricing.js";
import type { CatalogPort, OrderPort, PlacedOrder } from "./conversation.js";
import type { Session } from "./session.js";

/**
 * Real StackFood-backed ports for the conversation engine. This is the live
 * wiring — catalog reads and order placement go through the real
 * StackFoodClient / OrderAdapter, priced by the authoritative `priceOrder`
 * (never a customer-supplied price). It runs against the production API the
 * moment it has network access + credentials; in tests it runs against the
 * in-process StackFood mock.
 */

export interface StackFoodPortsConfig {
  client: StackFoodClient;
  auth: CustomerAuthProvisioner;
  adapter: OrderAdapter;
  /** Delivery zone for the pilot (Bandal). */
  zone: DeliveryZone;
  /** Monotonic TK-ref sequence — Redis INCR / Postgres sequence in prod. */
  nextSequence: () => number;
  /** Payer instructions appended to the récap (merchant numbers per operator). */
  payInstructions: (tkRef: string, totalFc: number) => string;
}

export function buildStackFoodCatalog(client: StackFoodClient): CatalogPort {
  return {
    async restaurants() {
      const { restaurants } = await client.getRestaurants(1, 8);
      return restaurants.map((r) => ({
        id: r.id,
        name: r.name,
        etaMin: parseInt(r.delivery_time, 10) || undefined,
      }));
    },
    async menu(restaurantId) {
      const { products } = await client.getLatestProducts(restaurantId, 1, 12);
      return products.map((p) => ({ food_id: p.id, name: p.name, price: p.price }));
    },
  };
}

const fmtFc = (n: number) => `${n.toLocaleString("fr-FR")} FC`;

export function buildStackFoodOrderPort(cfg: StackFoodPortsConfig): OrderPort {
  return {
    async place(session: Session): Promise<PlacedOrder> {
      if (!session.restaurantId) throw new Error("no restaurant selected");
      if (!session.cart.length) throw new Error("empty cart");

      // Authoritative price book from the menu we actually fetched from
      // StackFood — a customer can never inject a price.
      const priced = new Map(session.menuList?.map((m) => [m.food_id, m.price]) ?? []);
      const book: PriceBook = {
        product: (id) => (priced.has(id) ? { price: priced.get(id)! } : undefined),
        addOn: () => undefined,
      };
      const lines: QuoteLine[] = session.cart.map((c) => ({
        food_id: c.food_id,
        quantity: c.quantity,
      }));
      const quote = priceOrder(lines, book, cfg.zone);

      const tkRef = formatTkRef(cfg.nextSequence());
      const payload: PlaceOrderPayload = {
        cart: quote.lines,
        order_amount: quote.orderAmount,
        payment_method: "offline_payment",
        order_type: "delivery",
        restaurant_id: session.restaurantId,
        distance: 0,
        address: session.addressText ?? "",
        latitude: "0",
        longitude: "0",
        contact_person_name: "Client WhatsApp",
        contact_person_number: session.waId,
        address_type: "others",
        road: session.addressText ?? "",
        house: "-",
        floor: "-",
        dm_tips: 0,
        order_note: `NZELA ${tkRef}`,
        schedule_at: null,
      };

      const token = await cfg.auth.tokenFor(session.waId);
      const result = await cfg.adapter.placeIdempotent(payload, tkRef, token);

      const b = feeBreakdown(quote.subtotalFc, cfg.zone);
      const recap =
        `🧾 Commande ${tkRef} (n° ${result.orderId})\n` +
        `${session.restaurantName ?? ""}\n` +
        session.cart.map((c) => `${c.quantity}× ${c.name} — ${fmtFc(c.price * c.quantity)}`).join("\n") +
        `\nSous-total: ${fmtFc(b.subtotalFc)}` +
        `\nService (10%): ${fmtFc(b.serviceFc)} · Traitement (2%): ${fmtFc(b.processingFc)}` +
        `\nLivraison: ${fmtFc(b.deliveryFc)}` +
        `\n*Total: ${fmtFc(quote.orderAmount)}*\n\n` +
        cfg.payInstructions(tkRef, quote.orderAmount);
      return { tkRef, orderId: result.orderId, recap };
    },

    async status(waId: string): Promise<string | undefined> {
      // Latest order for the customer, mapped to a milestone.
      try {
        const token = await cfg.auth.tokenFor(waId);
        const res = await cfg.client.request<{ orders: { id: number; order_status?: string }[] }>(
          `/customer/order/list?offset=1&limit=1`,
          { token },
        );
        const last = res.orders[0];
        if (!last) return undefined;
        return `Commande n° ${last.id} — statut: ${last.order_status ?? "en cours"}.`;
      } catch {
        return undefined;
      }
    },
  };
}
