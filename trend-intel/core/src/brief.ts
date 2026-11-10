/**
 * Growth Brief v1 — the contract that connects all agents (spec §6, Appendix A).
 *
 * The brief is a CLOSED object: unknown fields are rejected, every field is
 * range/pattern-checked, and IDs resolve server-side. This module is the
 * zero-dependency reference validator — it enforces exactly the Appendix A
 * JSON Schema plus the "runtime rules beyond JSON Schema" (§507): time window
 * validity, channel membership, and (left to the caller with scope) evidence/
 * claim/policy resolution.
 *
 * Brand-neutral by design (spec portability rule §14): no platform slug, no
 * industry taxonomy, no default market/locale baked in here.
 */

/** Stable routing values reserved by the v1 schema (§6/§507). */
export const GROWTH_BRIEF_CHANNELS = [
  "seo",
  "organic_social",
  "sales_enablement",
  "owned_placement",
  "lifecycle",
  "paid",
] as const;
export type Channel = (typeof GROWTH_BRIEF_CHANNELS)[number];

/**
 * The only channels with a real draft route in v1 (§18/§507). The broader
 * enum "reserves stable routing values for future adapters and makes no
 * feature available on its own."
 */
export const V1_ENABLED_DRAFT_ROUTES: readonly Channel[] = ["seo", "organic_social"];

export interface GrowthBrief {
  schema_version: 1;
  brief_id: string;
  brief_version: number;
  tenant_id: string;
  platform_id: string;
  market: string;
  locale: string;
  topic_id: string;
  opportunity_score: number;
  confidence: number;
  valid_from: string;
  expires_at: string;
  evidence_ids: string[];
  audience: string;
  intent: string;
  approved_claim_ids: string[];
  cta_id: string;
  allowed_channels: Channel[];
  prohibited_claims: string[];
  objective: string;
  experiment_id: string;
  policy_version: number;
}

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

// --- primitive validators mirroring Appendix A $defs ---
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const MARKET_RE = /^[A-Z]{2}$/;
const UTC_RE = /Z$/;

const isId = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v);
const isScore = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
const isShortText = (v: unknown): v is string =>
  typeof v === "string" && v.length >= 1 && v.length <= 500;
const isPosInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1;
const isUtc = (v: unknown): v is string => {
  if (typeof v !== "string" || !UTC_RE.test(v)) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
};

function idList(v: unknown, field: string, errors: string[], minItems: number): void {
  if (!Array.isArray(v)) return void errors.push(`${field}: must be an array`);
  if (v.length < minItems) errors.push(`${field}: needs ≥${minItems} item(s)`);
  if (v.length > 64) errors.push(`${field}: at most 64 items`);
  if (new Set(v).size !== v.length) errors.push(`${field}: items must be unique`);
  v.forEach((x, i) => { if (!isId(x)) errors.push(`${field}[${i}]: invalid id`); });
}

const REQUIRED_FIELDS: (keyof GrowthBrief)[] = [
  "schema_version", "brief_id", "brief_version", "tenant_id", "platform_id",
  "market", "locale", "topic_id", "opportunity_score", "confidence",
  "valid_from", "expires_at", "evidence_ids", "audience", "intent",
  "approved_claim_ids", "cta_id", "allowed_channels", "prohibited_claims",
  "objective", "experiment_id", "policy_version",
];
const ALLOWED = new Set<string>(REQUIRED_FIELDS as string[]);

/**
 * Validate an unknown payload against the closed Growth Brief v1 schema.
 * Returns typed errors; does NOT check the time window (see `checkBriefWindow`)
 * or resolve scoped IDs (that is server-side with the authenticated tenant).
 */
export function validateGrowthBrief(input: unknown): Validated<GrowthBrief> {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["brief: must be an object"] };
  }
  const o = input as Record<string, unknown>;

  // additionalProperties: false — reject unknown fields outright.
  for (const k of Object.keys(o)) {
    if (!ALLOWED.has(k)) errors.push(`unknown field rejected: ${k}`);
  }
  for (const f of REQUIRED_FIELDS) {
    if (!(f in o)) errors.push(`missing required field: ${f}`);
  }

  if (o.schema_version !== 1) errors.push("schema_version: must be 1");
  if (!isId(o.brief_id)) errors.push("brief_id: invalid id");
  if (!isPosInt(o.brief_version)) errors.push("brief_version: integer ≥1");
  if (!isId(o.tenant_id)) errors.push("tenant_id: invalid id");
  if (!isId(o.platform_id)) errors.push("platform_id: invalid id");
  if (typeof o.market !== "string" || !MARKET_RE.test(o.market)) errors.push("market: ISO alpha-2 (^[A-Z]{2}$)");
  if (typeof o.locale !== "string" || o.locale.length < 2 || o.locale.length > 35) errors.push("locale: length 2–35");
  if (!isId(o.topic_id)) errors.push("topic_id: invalid id");
  if (!isScore(o.opportunity_score)) errors.push("opportunity_score: 0–100");
  if (!isScore(o.confidence)) errors.push("confidence: 0–100");
  if (!isUtc(o.valid_from)) errors.push("valid_from: RFC3339 UTC (…Z)");
  if (!isUtc(o.expires_at)) errors.push("expires_at: RFC3339 UTC (…Z)");
  idList(o.evidence_ids, "evidence_ids", errors, 1);
  if (!isShortText(o.audience)) errors.push("audience: text 1–500");
  if (!isShortText(o.intent)) errors.push("intent: text 1–500");
  idList(o.approved_claim_ids, "approved_claim_ids", errors, 0);
  if (!isId(o.cta_id)) errors.push("cta_id: invalid id");

  if (!Array.isArray(o.allowed_channels)) {
    errors.push("allowed_channels: array");
  } else {
    const ch = o.allowed_channels;
    if (ch.length < 1 || ch.length > 6) errors.push("allowed_channels: 1–6 items");
    if (new Set(ch).size !== ch.length) errors.push("allowed_channels: unique");
    ch.forEach((c, i) => {
      if (!GROWTH_BRIEF_CHANNELS.includes(c as Channel)) errors.push(`allowed_channels[${i}]: unknown channel`);
    });
  }

  if (!Array.isArray(o.prohibited_claims)) {
    errors.push("prohibited_claims: array");
  } else {
    if (o.prohibited_claims.length > 32) errors.push("prohibited_claims: at most 32");
    if (new Set(o.prohibited_claims).size !== o.prohibited_claims.length) errors.push("prohibited_claims: unique");
    o.prohibited_claims.forEach((c, i) => { if (!isShortText(c)) errors.push(`prohibited_claims[${i}]: text 1–500`); });
  }

  if (!isShortText(o.objective)) errors.push("objective: text 1–500");
  if (!isId(o.experiment_id)) errors.push("experiment_id: invalid id");
  if (!isPosInt(o.policy_version)) errors.push("policy_version: integer ≥1");

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: o as unknown as GrowthBrief };
}

export type BriefWindowStatus = "valid" | "not_yet_valid" | "expired" | "bad_window";

/**
 * Runtime time-window rule (§507): valid_from < expires_at AND
 * valid_from ≤ now < expires_at. A schema-valid brief can still fail this.
 */
export function checkBriefWindow(brief: GrowthBrief, nowMs: number): BriefWindowStatus {
  const from = Date.parse(brief.valid_from);
  const until = Date.parse(brief.expires_at);
  if (!(from < until)) return "bad_window";
  if (nowMs < from) return "not_yet_valid";
  if (nowMs >= until) return "expired";
  return "valid";
}

/** A brief is live (usable as read authority) only inside its window. */
export function isBriefLive(brief: GrowthBrief, nowMs: number): boolean {
  return checkBriefWindow(brief, nowMs) === "valid";
}

/** Channel-membership rule (§507): the action channel must be in the brief. */
export function briefAllowsChannel(brief: GrowthBrief, channel: Channel): boolean {
  return brief.allowed_channels.includes(channel);
}
