/**
 * Independent corroboration counting (spec §3, §5.5, §17).
 *
 * "Independent corroboration must be relevant to the same topic, market and
 * time." and "Syndicated stories, mirrors and amendments can contribute one
 * corroborating source family at most." This module collapses syndications and
 * counts DISTINCT source families among fresh, relevant observations — the
 * number that feeds `corroborationScore`.
 */

export interface CorrObservation {
  /** Source family, e.g. "first_party", "news_rss", "procurement_feed". */
  sourceFamily: string;
  /** Syndications/mirrors/amendments of one story share this key. */
  storyKey?: string;
  /** Within the freshness window (a stale source cannot corroborate fresh action). */
  fresh: boolean;
  /** Same topic, market and time as the opportunity. */
  relevant: boolean;
  /** True for context-only sources (pageviews, bulletins) — cannot satisfy the
   *  corroboration minimum on their own (§17). */
  contextOnly?: boolean;
}

/**
 * Collapse syndications to story units, then count distinct source families
 * among fresh + relevant + non-context observations. Context-only sources are
 * excluded from the corroboration count (they may still provide context).
 */
export function independentFamilyCount(obs: readonly CorrObservation[]): number {
  const eligible = obs.filter((o) => o.fresh && o.relevant && !o.contextOnly);
  // Group by storyKey; a syndicated story (shared key) counts once regardless
  // of how many mirror families carried it. Observations without a storyKey
  // are their own singleton groups.
  const families = new Set<string>();
  const seenStories = new Set<string>();
  for (const o of eligible) {
    if (o.storyKey !== undefined) {
      if (seenStories.has(o.storyKey)) continue; // already collapsed this story
      seenStories.add(o.storyKey);
    }
    families.add(o.sourceFamily);
  }
  return families.size;
}

/**
 * Cluster separation guard (§3, TI-14): two signals may share keywords but
 * carry different buyer intent / market / category. They must NOT merge. The
 * cluster key is intent+market+category — never collapsed by lexical/embedding
 * similarity alone.
 */
export function clusterKey(parts: { intent: string; market: string; category: string }): string {
  return [parts.intent, parts.market, parts.category].map((s) => s.trim().toLowerCase()).join("|");
}

export function sameCluster(
  a: { intent: string; market: string; category: string },
  b: { intent: string; market: string; category: string },
): boolean {
  return clusterKey(a) === clusterKey(b);
}
