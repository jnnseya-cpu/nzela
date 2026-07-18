import { createHash } from "node:crypto";
import type { CartLine } from "./types.js";

/**
 * Idempotency & order refs — FR-O3/FR-O4 and Integration Spec §5.
 */

/** Stable hash of cart contents (order-insensitive across line order). */
export function cartHash(cart: readonly CartLine[]): string {
  const canonical = [...cart]
    .map((l) => ({
      food_id: l.food_id,
      quantity: l.quantity,
      variant: l.variant ?? "",
      add_ons: [...(l.add_ons ?? [])].sort((a, b) => a - b),
    }))
    .sort((a, b) => a.food_id - b.food_id);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/**
 * FR-O4: Idempotency-Key = sha256(wa_id + cart_hash + minute_bucket).
 * Duplicate sends within the same minute bucket must not create duplicate
 * StackFood orders.
 */
export function idempotencyKey(
  waId: string,
  cartHashHex: string,
  at: Date,
): string {
  const minuteBucket = Math.floor(at.getTime() / 60_000);
  return createHash("sha256")
    .update(`${waId}${cartHashHex}${minuteBucket}`)
    .digest("hex");
}

/**
 * NZELA human-readable order ref (TK-xxx) — the join key carried in
 * `order_note`, printed on the wewa pickup card and quoted in mobile-money
 * references.
 */
export function formatTkRef(sequence: number): string {
  return `TK-${sequence}`;
}

export const TK_REF_PATTERN = /TK[-\s]?(\d{2,6})/i;

/** Extract a TK ref from free text (SMS bodies, order notes, captions). */
export function extractTkRef(text: string): string | undefined {
  const m = TK_REF_PATTERN.exec(text);
  return m ? `TK-${m[1]}` : undefined;
}
