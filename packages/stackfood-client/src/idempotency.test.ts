import { describe, expect, it } from "vitest";
import {
  cartHash,
  extractTkRef,
  formatTkRef,
  idempotencyKey,
} from "./idempotency.js";
import type { CartLine } from "./types.js";

const cart: CartLine[] = [
  { food_id: 1042, price: 15000, quantity: 2, variations: [], add_ons: [] },
  { food_id: 1088, price: 2000, quantity: 1, variations: [], add_ons: [] },
];

describe("idempotency (FR-O4)", () => {
  it("is stable within the same minute bucket", () => {
    const a = idempotencyKey("+243810000047", cartHash(cart), new Date("2026-07-18T19:12:05Z"));
    const b = idempotencyKey("+243810000047", cartHash(cart), new Date("2026-07-18T19:12:59Z"));
    expect(a).toBe(b);
  });

  it("changes across minute buckets and customers", () => {
    const base = idempotencyKey("+243810000047", cartHash(cart), new Date("2026-07-18T19:12:05Z"));
    expect(
      idempotencyKey("+243810000047", cartHash(cart), new Date("2026-07-18T19:13:05Z")),
    ).not.toBe(base);
    expect(
      idempotencyKey("+243810000099", cartHash(cart), new Date("2026-07-18T19:12:05Z")),
    ).not.toBe(base);
  });

  it("cart hash ignores line order", () => {
    expect(cartHash(cart)).toBe(cartHash([...cart].reverse()));
  });
});

describe("TK refs (join key)", () => {
  it("formats and extracts refs from free text", () => {
    expect(formatTkRef(347)).toBe("TK-347");
    expect(extractTkRef("MPESA QGH7X2 recu 22.540 FC ref TK-347")).toBe("TK-347");
    expect(extractTkRef("paiement tk 347 merci")).toBe("TK-347");
    expect(extractTkRef("aucun code ici")).toBeUndefined();
  });
});
