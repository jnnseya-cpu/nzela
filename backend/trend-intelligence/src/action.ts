/**
 * Typed proposed-action validation (spec §6, §18; TI-06).
 *
 * The model returns PROPOSALS as structured JSON. The executor "interprets
 * only validated typed actions." This closed parser is the firewall: a model
 * output that says "bypass approvals" or "change spend" cannot become a
 * privileged action, because only the enumerated action kinds and an
 * allowlisted field set are representable. Everything else is rejected.
 */

export const LIVE_ACTION_KINDS = ["seo_metadata_patch", "owned_content_patch"] as const;
export const DRAFT_ACTION_KINDS = ["seo_page_draft", "organic_social_draft"] as const;
export const ACTION_KINDS = [...LIVE_ACTION_KINDS, ...DRAFT_ACTION_KINDS] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

/** Patchable fields (§18): title, description, one approved named body block.
 *  URL, redirects, canonical, robots, structured data, permissions and
 *  template code are OUT OF SCOPE for v1 automation. */
export const ALLOWED_PATCH_FIELDS = ["title", "description", "body_block"] as const;
export type PatchField = (typeof ALLOWED_PATCH_FIELDS)[number];

export interface ProposedAction {
  action_kind: ActionKind;
  channel: string;
  target_id?: string;
  fields: Partial<Record<PatchField, string>>;
  evidence_ids: string[];
  approved_claim_ids: string[];
}

export type ParseResult =
  | { ok: true; value: ProposedAction }
  | { ok: false; errors: string[] };

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const idArray = (v: unknown, field: string, errors: string[]): void => {
  if (!Array.isArray(v)) return void errors.push(`${field}: array required`);
  if (v.length > 64) errors.push(`${field}: at most 64`);
  v.forEach((x, i) => { if (typeof x !== "string" || !ID_RE.test(x)) errors.push(`${field}[${i}]: invalid id`); });
};

const TOP_LEVEL = new Set(["action_kind", "channel", "target_id", "fields", "evidence_ids", "approved_claim_ids"]);

/**
 * Validate a parsed object as a ProposedAction. Rejects unknown top-level
 * keys, unknown action kinds, and any field outside the patch allowlist — so
 * injected keys like `grant`, `publish`, `spend`, `approve` are structurally
 * impossible to carry through.
 */
export function parseProposedAction(input: unknown): ParseResult {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["action: must be an object"] };
  }
  const o = input as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!TOP_LEVEL.has(k)) errors.push(`unknown field rejected: ${k}`);

  if (!ACTION_KINDS.includes(o.action_kind as ActionKind)) errors.push(`action_kind: unknown (${String(o.action_kind)})`);
  if (typeof o.channel !== "string" || o.channel.length < 1 || o.channel.length > 64) errors.push("channel: text 1–64");
  if (o.target_id !== undefined && (typeof o.target_id !== "string" || !ID_RE.test(o.target_id))) errors.push("target_id: invalid id");

  if (typeof o.fields !== "object" || o.fields === null || Array.isArray(o.fields)) {
    errors.push("fields: object required");
  } else {
    const f = o.fields as Record<string, unknown>;
    for (const k of Object.keys(f)) {
      if (!ALLOWED_PATCH_FIELDS.includes(k as PatchField)) {
        errors.push(`fields.${k}: not an allowlisted patch field`);
      } else if (typeof f[k] !== "string" || (f[k] as string).length > 5000) {
        errors.push(`fields.${k}: must be a string ≤5000 chars`);
      }
    }
  }
  idArray(o.evidence_ids, "evidence_ids", errors);
  idArray(o.approved_claim_ids, "approved_claim_ids", errors);

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: o as unknown as ProposedAction };
}

/** Parse raw model TEXT: invalid JSON is rejected (never trusted). */
export function parseModelAction(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ["invalid JSON from model"] };
  }
  return parseProposedAction(parsed);
}

export const isLiveActionKind = (k: ActionKind): boolean =>
  (LIVE_ACTION_KINDS as readonly string[]).includes(k);
