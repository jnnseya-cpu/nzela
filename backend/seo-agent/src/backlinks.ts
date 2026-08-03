import type { BacklinkTarget, BlogPost } from "./types.js";

/**
 * Backlink pipeline. Honest by design: you cannot ethically fabricate
 * backlinks (Google penalizes link schemes). What autopilot CAN do is
 * (1) match your content to relevant, high-authority prospect sites,
 * (2) prioritize outreach, and (3) track earned links. The durable win
 * is link-worthy assets — here, the proprietary Kinshasa delivery data —
 * that earn citations naturally.
 */

/** Score a prospect for a post: topical fit × authority. */
export function scoreProspect(target: BacklinkTarget, post: BlogPost): number {
  const kw = new Set(post.keywords.map((k) => k.toLowerCase()));
  const fit = target.topics.filter((t) => kw.has(t.toLowerCase())).length;
  if (fit === 0) return 0;
  return fit * (target.authority / 100);
}

/** Ranked outreach list for a post — best prospects first. */
export function outreachQueue(
  targets: readonly BacklinkTarget[],
  post: BlogPost,
): BacklinkTarget[] {
  return targets
    .filter((t) => t.status === "prospect" && scoreProspect(t, post) > 0)
    .sort((a, b) => scoreProspect(b, post) - scoreProspect(a, post));
}

export interface BacklinkHealth {
  live: number;
  contacted: number;
  prospects: number;
  /** Estimated authority earned = sum of authority of live links. */
  earnedAuthority: number;
}

export function backlinkHealth(
  targets: readonly BacklinkTarget[],
): BacklinkHealth {
  const by = (s: BacklinkTarget["status"]) =>
    targets.filter((t) => t.status === s);
  return {
    live: by("live").length,
    contacted: by("contacted").length,
    prospects: by("prospect").length,
    earnedAuthority: by("live").reduce((s, t) => s + t.authority, 0),
  };
}
