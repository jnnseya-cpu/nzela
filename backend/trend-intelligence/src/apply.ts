import type { GrowthBrief } from "./brief.js";
import type { PlatformProfile } from "./nzela-profile.js";

/**
 * Brief → agent directives. This is where the versioned Growth Brief changes
 * what the EXISTING NZELA agents do (spec §1, §4): the SEO agent's target
 * keyword + allowed claims, and the growth engine's featured highlights. The
 * agents keep their own roles and permissions; the brief only sets priorities
 * and approved claims at run time. Claim TEXT is resolved here via a scoped
 * profile lookup — an agent never acts on free-text claims.
 */

const langFromLocale = (locale: string): "fr" | "en" | "ar" | "es" | "zh" => {
  const base = locale.slice(0, 2).toLowerCase();
  return base === "en" || base === "ar" || base === "es" || base === "zh" ? base : "fr";
};

/** Resolve the brief's approved claim ids to their approved texts (scoped). */
export function resolveClaimTexts(brief: GrowthBrief, profile: PlatformProfile): string[] {
  return brief.approved_claim_ids
    .map((id) => profile.approved_claims[id])
    .filter((t): t is string => typeof t === "string");
}

export interface SeoDirective {
  /** Primary target keyword/topic for the SEO agent this cycle. */
  keyword: string;
  keywords: string[];
  lang: "fr" | "en" | "ar" | "es" | "zh";
  approvedClaims: string[];
  prohibitedClaims: string[];
  audience: string;
  intent: string;
  /** Brief provenance so the SEO work is auditable back to the decision. */
  briefId: string;
  briefVersion: number;
}

/**
 * Turn an effective brief into an SEO directive the SEO autopilot consumes
 * (its `PublishInput` keyword/keywords, plus the claim guard-rails).
 */
export function briefToSeoDirective(brief: GrowthBrief, profile: PlatformProfile): SeoDirective {
  const keyword = brief.topic_id.replace(/-/g, " ");
  const keywords = Array.from(new Set(keyword.split(/\s+/).filter((t) => t.length >= 3)));
  return {
    keyword,
    keywords,
    lang: langFromLocale(brief.locale),
    approvedClaims: resolveClaimTexts(brief, profile),
    prohibitedClaims: brief.prohibited_claims,
    audience: brief.audience,
    intent: brief.intent,
    briefId: brief.brief_id,
    briefVersion: brief.brief_version,
  };
}

export interface MarketingDirective {
  /** Selling points the growth engine should feature (approved claim texts). */
  highlights: string[];
  approvedClaims: string[];
  prohibitedClaims: string[];
  audience: string;
  intent: string;
  lang: "fr" | "en" | "ar" | "es" | "zh";
  briefId: string;
  briefVersion: number;
}

/** Turn an effective brief into a marketing directive for the growth engine. */
export function briefToMarketingDirective(brief: GrowthBrief, profile: PlatformProfile): MarketingDirective {
  const claims = resolveClaimTexts(brief, profile);
  return {
    highlights: claims,
    approvedClaims: claims,
    prohibitedClaims: brief.prohibited_claims,
    audience: brief.audience,
    intent: brief.intent,
    lang: langFromLocale(brief.locale),
    briefId: brief.brief_id,
    briefVersion: brief.brief_version,
  };
}

/**
 * Merge a marketing directive into an existing partner brief shape (the growth
 * engine's `PartnerBrief`), so a partner's generated marketing is on-brief.
 * Structural — avoids a compile-time coupling to the growth-engine package.
 */
export function applyBriefToPartnerBrief<
  T extends { highlights: string[]; lang: "fr" | "en" | "ar" | "es" | "zh" },
>(base: T, brief: GrowthBrief, profile: PlatformProfile): T {
  const d = briefToMarketingDirective(brief, profile);
  return { ...base, highlights: [...d.highlights, ...base.highlights], lang: d.lang };
}
