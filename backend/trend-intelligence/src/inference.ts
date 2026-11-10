import type { SeoDirective, MarketingDirective } from "./apply.js";
import { parseProposedAction, type ProposedAction } from "./action.js";

/**
 * Inference gateway (spec §2, §14). Keyless by contract: the module calls the
 * host's AI service through this interface or uses the deterministic/template
 * path — it NEVER holds a provider key, and no key field exists in its config,
 * prompts or logs. On model failure/timeout/unsupported, it falls back to
 * templates (TI-10, TI-19). Generated output is always schema-validated before
 * it can become an action (§8 trust boundary).
 */

export interface GenRequest {
  installationId: string;
  requestId: string;
  purpose: "seo_draft" | "social_draft";
  /** Approved model alias (server-authorised), never a provider key. */
  modelAlias?: string;
  schemaRevision: number;
  /** Sanitised directive — the only "input" the model sees. */
  directive: SeoDirective | MarketingDirective;
  deadlineMs: number;
  tokenLimit: number;
}

export type GenStatus = "ok" | "fallback" | "error";
export interface GenResponse {
  requestId: string;
  action: ProposedAction | null;
  mode: "model" | "template";
  status: GenStatus;
  modelId?: string;
}

export interface HostAiGateway {
  capabilities(): { structured: boolean; embed: boolean };
  /** Returns a STRUCTURED proposed action, or throws/times out. */
  generateStructured(req: GenRequest): Promise<unknown>;
}

const fc = (s: string) => s.trim();

/** Deterministic template drafts — the keyless, model-free path (§2, §17). */
export function templateAction(req: GenRequest): ProposedAction {
  const d = req.directive;
  const claim = d.approvedClaims[0] ?? "";
  if (req.purpose === "seo_draft") {
    const seo = d as SeoDirective;
    return {
      action_kind: "seo_page_draft",
      channel: "seo",
      fields: {
        title: fc(`${capitalise(seo.keyword)} — Tunakula`),
        description: fc(`${seo.audience}. ${claim}`).slice(0, 160),
        body_block: fc(`${claim}\n\nPour « ${seo.keyword} » : commande sur WhatsApp.`),
      },
      evidence_ids: [],
      approved_claim_ids: [],
    };
  }
  return {
    action_kind: "organic_social_draft",
    channel: "organic_social",
    fields: { body_block: fc(`${claim} ${hashtagless(d.audience)}`) },
    evidence_ids: [],
    approved_claim_ids: [],
  };
}

const capitalise = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const hashtagless = (s: string) => s.replace(/#/g, "");

/**
 * Generate a draft through the host gateway when available + valid, else the
 * deterministic template. Validates structured model output; invalid/failed
 * output does NOT block the workflow — it degrades to a template.
 */
export async function generateDraft(req: GenRequest, gateway?: HostAiGateway): Promise<GenResponse> {
  if (gateway && gateway.capabilities().structured) {
    try {
      const raw = await gateway.generateStructured(req);
      const parsed = parseProposedAction(raw);
      if (parsed.ok) {
        return { requestId: req.requestId, action: parsed.value, mode: "model", status: "ok", modelId: req.modelAlias };
      }
      // invalid structured output → fall through to template (never trust it)
    } catch {
      // timeout / outage → template
    }
    return { requestId: req.requestId, action: templateAction(req), mode: "template", status: "fallback" };
  }
  // no model configured → deterministic template
  return { requestId: req.requestId, action: templateAction(req), mode: "template", status: "fallback" };
}

/** A gateway with no model — always reports structured:false (disconnected/deterministic). */
export class DeterministicGateway implements HostAiGateway {
  capabilities() { return { structured: false, embed: false }; }
  async generateStructured(): Promise<unknown> { throw new Error("no model: deterministic mode"); }
}
