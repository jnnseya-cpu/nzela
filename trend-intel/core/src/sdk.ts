/**
 * Effective-brief SDK (spec §4, §14 step 5; TI-05).
 *
 * Existing agents resolve the effective brief at run time. Rules enforced here:
 *  - cache within a 60-second ceiling, NEVER beyond the brief's expiry;
 *  - on timeout / disabled entitlement / missing capability / no approved
 *    brief, fall back to host baseline behaviour;
 *  - NEVER use the cache as authority to write or publish — `assertWritable`
 *    re-checks liveness against a fresh fetch, not the cache.
 */
import { type GrowthBrief, isBriefLive } from "./brief.js";

export interface BriefScope {
  tenant_id: string;
  platform_id: string;
  market: string;
  locale: string;
  channel: string;
  topic_id: string;
}

export const scopeKey = (s: BriefScope): string =>
  [s.tenant_id, s.platform_id, s.market, s.locale, s.channel, s.topic_id].join("|");

export type ResolveResult =
  | { source: "brief"; brief: GrowthBrief }
  | { source: "baseline"; reason: "no_brief" | "expired" | "error" };

const CACHE_CEILING_MS = 60_000;

export interface ResolverDeps {
  /** Fetch the approved current brief for a scope, or undefined. May throw. */
  fetchApproved: (scope: BriefScope) => Promise<GrowthBrief | undefined>;
  /** Cache TTL; clamped to the 60s ceiling. */
  cacheTtlMs?: number;
}

export class EffectiveBriefResolver {
  private readonly ttl: number;
  private readonly cache = new Map<string, { brief: GrowthBrief; cachedAtMs: number }>();

  constructor(private readonly deps: ResolverDeps) {
    this.ttl = Math.min(Math.max(0, deps.cacheTtlMs ?? CACHE_CEILING_MS), CACHE_CEILING_MS);
  }

  /** READ path: returns a cached-or-fresh live brief, else baseline. */
  async resolve(scope: BriefScope, nowMs: number): Promise<ResolveResult> {
    const key = scopeKey(scope);
    const hit = this.cache.get(key);
    if (hit && nowMs - hit.cachedAtMs < this.ttl && isBriefLive(hit.brief, nowMs)) {
      return { source: "brief", brief: hit.brief };
    }
    if (hit && !isBriefLive(hit.brief, nowMs)) this.cache.delete(key); // never serve past expiry

    let fresh: GrowthBrief | undefined;
    try {
      fresh = await this.deps.fetchApproved(scope);
    } catch {
      return { source: "baseline", reason: "error" };
    }
    if (!fresh) return { source: "baseline", reason: "no_brief" };
    if (!isBriefLive(fresh, nowMs)) return { source: "baseline", reason: "expired" };
    this.cache.set(key, { brief: fresh, cachedAtMs: nowMs });
    return { source: "brief", brief: fresh };
  }

  /**
   * WRITE path authority: NEVER trusts the cache. Re-fetches and re-checks
   * liveness; only a fresh, live, matching brief authorises a write.
   */
  async assertWritable(
    scope: BriefScope,
    nowMs: number,
  ): Promise<{ ok: true; brief: GrowthBrief } | { ok: false; reason: "no_brief" | "expired" | "error" }> {
    let fresh: GrowthBrief | undefined;
    try {
      fresh = await this.deps.fetchApproved(scope);
    } catch {
      return { ok: false, reason: "error" };
    }
    if (!fresh) return { ok: false, reason: "no_brief" };
    if (!isBriefLive(fresh, nowMs)) return { ok: false, reason: "expired" };
    return { ok: true, brief: fresh };
  }
}
