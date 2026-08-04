/**
 * Partner AI Growth Engine (agent #10) — the marketing suite a restaurant
 * partner sees in its dashboard. Ten tools, split by the NZELA rule:
 * generators need language (budgeted LLM), analytics need only the
 * partner's own numbers (deterministic, 0 tokens).
 */

export type GrowthTool =
  // LLM generators (budgeted)
  | "social-post"
  | "advert"
  | "email-campaign"
  | "landing-page"
  | "video-script"
  // Deterministic analytics (0 tokens)
  | "hashtags"
  | "best-time"
  | "performance-recos"
  | "audience-optimisation"
  | "campaign-analytics";

export type Channel =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "whatsapp-status"
  | "x";

export type Lang = "fr" | "en" | "ar" | "es" | "zh";

export interface PartnerBrief {
  restaurantName: string;
  quartier: string;
  /** Signature dishes / offer to feature. */
  highlights: string[];
  lang: Lang;
  waLink: string;
}

/** One engagement record for a published piece — the analytics substrate. */
export interface EngagementRecord {
  channel: Channel;
  /** ISO datetime the piece was posted (local Kinshasa time assumed). */
  postedAt: string;
  impressions: number;
  clicks: number;
  /** Orders attributed to this piece (via wa.me tagged link). */
  orders: number;
  spendUsd: number;
}

export interface GeneratedContent {
  tool: GrowthTool;
  channel?: Channel;
  title?: string;
  body: string;
  hashtags?: string[];
  costUsd: number;
}
