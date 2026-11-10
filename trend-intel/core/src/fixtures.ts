import type { GrowthBrief } from "./brief.js";

/**
 * Canonical fixtures from the spec. SYNTHETIC sample data only — production
 * values come from the installation profile. These are the positive fixtures
 * the validator and conformance tests run against (§6, §16).
 */

/** §6 — canonical positive Growth Brief v1 payload. */
export const GROWTH_BRIEF_FIXTURE: GrowthBrief = {
  schema_version: 1,
  brief_id: "gb_104",
  brief_version: 3,
  tenant_id: "tenant_demo",
  platform_id: "fixture_platform_a",
  market: "CA",
  locale: "en-CA",
  topic_id: "simpler-team-onboarding",
  opportunity_score: 86.25,
  confidence: 83.5,
  valid_from: "2026-11-10T10:00:00Z",
  expires_at: "2026-11-17T10:00:00Z",
  evidence_ids: ["ev_341", "ev_342"],
  audience: "Small teams comparing onboarding options",
  intent: "evaluate how to onboard a small team",
  approved_claim_ids: ["claim_onboarding_01"],
  cta_id: "cta_view_onboarding_guide",
  allowed_channels: ["seo", "organic_social"],
  prohibited_claims: ["guaranteed onboarding time", "unsupported third-party endorsements"],
  objective: "qualified trial starts per eligible session",
  experiment_id: "exp_91",
  policy_version: 5,
};

/** §16 — v1 installation profile fixture (matches the brief above). */
export const PROFILE_FIXTURE = {
  schema_version: 1,
  platform_slug: "fixture_platform_a",
  mode: "draft_only",
  default_market: "CA",
  default_locale: "en-CA",
  allowed_channels: ["seo", "organic_social"],
  allowed_asset_ids: ["asset_onboarding_page"],
  approved_claim_ids: ["claim_onboarding_01"],
  allowed_cta_ids: ["cta_view_onboarding_guide"],
  outcome: { conversion: "qualified_trial_started", denominator: "eligible_session" },
  timezone: "America/Toronto",
} as const;

/** A point in time inside the fixture brief's validity window. */
export const INSIDE_WINDOW_MS = Date.parse("2026-11-12T10:00:00Z");
/** A point in time after the fixture brief has expired. */
export const AFTER_EXPIRY_MS = Date.parse("2026-11-18T10:00:00Z");
