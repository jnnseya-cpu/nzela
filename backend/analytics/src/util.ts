import { createHash } from "node:crypto";
import type { FetchLike } from "./types.js";

/** An ID is "configured" only if it is set and not a `__PLACEHOLDER__`. */
export function configured(v: string | undefined): boolean {
  return !!v && v.indexOf("__") !== 0 && v.length > 3;
}

/** Meta/GA advanced-matching normalization: trim, lowercase, sha256 hex. */
export function hashPii(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const norm = raw.trim().toLowerCase();
  if (!norm) return undefined;
  return createHash("sha256").update(norm).digest("hex");
}

/** Phone: strip everything but digits (drop +, spaces) before hashing. */
export function hashPhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return undefined;
  return createHash("sha256").update(digits).digest("hex");
}

/** Deterministic GA4 client_id ("N.N") from a stable seed (wa_id / tkRef). */
export function ga4ClientId(seed: string): string {
  const h = createHash("sha256").update(seed).digest();
  return `${h.readUInt32BE(0)}.${h.readUInt32BE(4)}`;
}

/** Stable event id so a server event dedups with its browser-pixel twin. */
export function eventIdFor(name: string, tkRef: string): string {
  return `${name}:${tkRef}`;
}

/** Default fetch, adapted to FetchLike without pulling in DOM types. */
export const defaultFetch: FetchLike = (url, init) => {
  const g = globalThis as unknown as {
    fetch?: (u: string, i: unknown) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
  };
  if (!g.fetch) throw new Error("global fetch unavailable");
  return g.fetch(url, init);
};
