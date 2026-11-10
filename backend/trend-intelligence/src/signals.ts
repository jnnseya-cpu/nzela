import type { CorrObservation } from "./corroboration.js";

/**
 * NZELA first-party signal adapters (spec §3 "First-party internal search,
 * product events, conversions"). These map NZELA-OS's real events — orders,
 * verified payments, blog attention, conversation intents, referrals — into
 * normalised trend observations. First-party events alone can support a
 * deployment (§2 acceptance matrix), which is exactly NZELA's keyless case.
 *
 * Source families are kept distinct so independent corroboration is real:
 * a verified payment and a blog view are different families; two orders are
 * the same family (not independent corroboration).
 */

export type NzelaSignalKind =
  | "order_placed" // demand: a cart reached checkout
  | "payment_verified" // conversion: a real paid order (strongest first-party proof)
  | "blog_view" // attention (context only — not buyer intent)
  | "conversation_intent" // internal-search-like demand from a WhatsApp message
  | "referral_settled"; // word-of-mouth demand

export interface NzelaSignal {
  kind: NzelaSignalKind;
  /** Topic this signal is about (profile topic id). */
  topic: string;
  /** Observation time (epoch ms). */
  atMs: number;
  /** Optional dedup key (e.g. tkRef) so replays don't inflate counts. */
  dedupKey?: string;
  market?: string;
  locale?: string;
}

const FAMILY: Record<NzelaSignalKind, string> = {
  order_placed: "first_party_orders",
  payment_verified: "first_party_conversions",
  blog_view: "owned_page_attention",
  conversation_intent: "first_party_search",
  referral_settled: "first_party_referrals",
};

/** Context-only families cannot satisfy the corroboration minimum (§17). */
const CONTEXT_ONLY = new Set<string>(["owned_page_attention"]);

/** Demand weight per signal kind — a paid order proves more than a page view. */
const DEMAND_WEIGHT: Record<NzelaSignalKind, number> = {
  payment_verified: 3,
  order_placed: 2,
  conversation_intent: 1,
  referral_settled: 2,
  blog_view: 0, // attention, not demand — contributes context only
};

export const signalFamily = (kind: NzelaSignalKind): string => FAMILY[kind];
export const demandWeight = (kind: NzelaSignalKind): number => DEMAND_WEIGHT[kind];

/**
 * Convert a signal to a corroboration observation for a given topic/window.
 * `fresh` = within the freshness window; `relevant` = same topic (+ market
 * when provided).
 */
export function toObservation(
  s: NzelaSignal,
  opts: { freshnessMs: number; nowMs: number; topic: string; market?: string },
): CorrObservation {
  const family = FAMILY[s.kind];
  const fresh = opts.nowMs - s.atMs <= opts.freshnessMs;
  const relevant = s.topic === opts.topic && (!opts.market || !s.market || s.market === opts.market);
  return {
    sourceFamily: family,
    // Each distinct dedupKey is its own "story"; same key collapses (no replay inflation).
    storyKey: s.dedupKey ? `${family}:${s.dedupKey}` : undefined,
    fresh,
    relevant,
    contextOnly: CONTEXT_ONLY.has(family),
  };
}

/**
 * Accumulate a weighted demand count for a topic over a set of signals in the
 * current window (dedup by key within a family so replays don't inflate).
 */
export function demandCount(signals: readonly NzelaSignal[], topic: string): number {
  const seen = new Set<string>();
  let total = 0;
  for (const s of signals) {
    if (s.topic !== topic) continue;
    if (s.dedupKey) {
      const k = `${s.kind}:${s.dedupKey}`;
      if (seen.has(k)) continue;
      seen.add(k);
    }
    total += DEMAND_WEIGHT[s.kind];
  }
  return total;
}
