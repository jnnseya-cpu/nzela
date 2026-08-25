import type { CartLine, PlaceOrderPayload } from "@nzela/stackfood-client";
import type { DeliveryZone } from "@nzela/landmark-graph";
import { feeBreakdown, type FeeBreakdown } from "./recap.js";

/**
 * Server-authoritative pricing — the ONLY sanctioned way to compute what a
 * customer owes. This closes the single biggest money loophole: StackFood
 * (like most e-commerce APIs) trusts the `price` and `order_amount` sent in
 * the order payload, so if the WhatsApp order builder ever copied a
 * customer-influenced price, a customer could declare a lower price and pay
 * less for real goods. Here every unit price is looked up from the menu
 * (the PriceBook), quantities are validated, fees are computed, and the
 * `order_amount` is derived — never accepted. The builder MUST call
 * `priceOrder`; the adapter path SHOULD call `verifyPayloadPricing` as
 * defence in depth so a tampered payload can never be placed.
 */

export const MAX_LINE_QTY = 50;
export const MAX_CART_LINES = 50;

export class PricingError extends Error {}

/** Authoritative price source — resolves menu/add-on prices server-side. */
export interface PriceBook {
  product(foodId: number): { price: number } | undefined;
  addOn(id: number): { price: number } | undefined;
}

export interface QuoteLine {
  food_id: number;
  quantity: number;
  variant?: string;
  variations?: unknown[];
  add_ons?: number[];
  add_on_qtys?: number[];
  item_campaign_id?: number | null;
}

export interface Quote {
  /** StackFood cart lines with SERVER-set prices (never customer-supplied). */
  lines: CartLine[];
  subtotalFc: number;
  fees: FeeBreakdown;
  /** The authoritative amount the customer must pay = fees.totalFc. */
  orderAmount: number;
}

function requirePositiveInt(n: unknown, what: string, max: number): number {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > max) {
    throw new PricingError(`${what} must be an integer in [1, ${max}], got ${n}`);
  }
  return n;
}

function requireMenuPrice(price: unknown, what: string): number {
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    throw new PricingError(`${what} has a non-finite/negative menu price`);
  }
  return price;
}

/** Authoritative line total: unit price × qty + Σ add-on price × add-on qty. */
function priceLine(line: QuoteLine, book: PriceBook): { cartLine: CartLine; lineFc: number } {
  const qty = requirePositiveInt(line.quantity, `quantity for food ${line.food_id}`, MAX_LINE_QTY);
  const product = book.product(line.food_id);
  if (!product) throw new PricingError(`unknown food_id ${line.food_id}`);
  const unit = requireMenuPrice(product.price, `food ${line.food_id}`);

  const addOns = line.add_ons ?? [];
  const addOnQtys = line.add_on_qtys ?? addOns.map(() => 1);
  if (addOnQtys.length !== addOns.length) {
    throw new PricingError(`add_on_qtys length ≠ add_ons length for food ${line.food_id}`);
  }
  let addOnFc = 0;
  for (let i = 0; i < addOns.length; i++) {
    const ao = book.addOn(addOns[i]!);
    if (!ao) throw new PricingError(`unknown add_on ${addOns[i]}`);
    const aoQty = requirePositiveInt(addOnQtys[i], `add_on_qty for ${addOns[i]}`, MAX_LINE_QTY);
    addOnFc += requireMenuPrice(ao.price, `add_on ${addOns[i]}`) * aoQty;
  }

  const cartLine: CartLine = {
    food_id: line.food_id,
    item_campaign_id: line.item_campaign_id ?? null,
    price: unit, // SERVER price — overrides anything a caller might pass
    variant: line.variant,
    variations: line.variations,
    add_ons: addOns,
    add_on_qtys: addOnQtys,
    quantity: qty,
  };
  return { cartLine, lineFc: unit * qty + addOnFc };
}

/**
 * Build an authoritative quote from a requested cart. Throws on any invalid
 * line (unknown item, bad quantity, non-finite price) — fail closed, never
 * price an unknown item at 0.
 */
export function priceOrder(
  lines: readonly QuoteLine[],
  book: PriceBook,
  zone: DeliveryZone,
  opts: { rainMultiplier?: number } = {},
): Quote {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new PricingError("empty cart");
  }
  if (lines.length > MAX_CART_LINES) {
    throw new PricingError(`too many cart lines (> ${MAX_CART_LINES})`);
  }
  const cartLines: CartLine[] = [];
  let subtotalFc = 0;
  for (const line of lines) {
    const { cartLine, lineFc } = priceLine(line, book);
    cartLines.push(cartLine);
    subtotalFc += lineFc;
  }
  const fees = feeBreakdown(subtotalFc, zone, opts);
  return { lines: cartLines, subtotalFc, fees, orderAmount: fees.totalFc };
}

/**
 * Defence in depth: recompute a payload's price from the menu and reject it
 * if the per-line prices or the order_amount don't match. Any tampered
 * payload (lowered price, wrong total) is refused before it can be placed.
 */
export function verifyPayloadPricing(
  payload: Pick<PlaceOrderPayload, "cart" | "order_amount">,
  book: PriceBook,
  zone: DeliveryZone,
  opts: { rainMultiplier?: number } = {},
): void {
  const quote = priceOrder(payload.cart as QuoteLine[], book, zone, opts);
  // Per-line unit price must equal the authoritative menu price.
  for (let i = 0; i < payload.cart.length; i++) {
    const claimed = payload.cart[i]!.price;
    const authoritative = quote.lines[i]!.price;
    if (claimed !== authoritative) {
      throw new PricingError(
        `line ${i} price ${claimed} ≠ menu price ${authoritative} (tampered)`,
      );
    }
  }
  if (payload.order_amount !== quote.orderAmount) {
    throw new PricingError(
      `order_amount ${payload.order_amount} ≠ authoritative ${quote.orderAmount} (tampered)`,
    );
  }
}
