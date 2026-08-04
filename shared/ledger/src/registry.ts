import type { AgentId } from "./types.js";

/**
 * Agent registry — §5 of the Developer Requirements. Budgets are HARD caps
 * per call (or per order where noted), enforced by the budget middleware.
 * Changing a budget is a product decision, not an engineering one.
 */

export type AgentKind =
  | "deterministic"
  | "llm-small"
  | "llm-stt"
  | "regex-vision"
  | "deterministic-tts"
  | "algorithmic"
  | "llm-single-shot";

export interface AgentSpec {
  id: AgentId;
  name: string;
  kind: AgentKind;
  /** Hard USD budget per invocation. 0 = must never spend tokens. */
  budgetPerCallUsd: number;
  /** Hard USD budget per order (only where the spec caps per order). */
  budgetPerOrderUsd?: number;
  role: string;
}

export const AGENT_REGISTRY: Record<AgentId, AgentSpec> = {
  router: {
    id: "router",
    name: "NZELA Router",
    kind: "deterministic",
    budgetPerCallUsd: 0,
    role: "Keyword/button routing, session state, AI firewall",
  },
  commande: {
    id: "commande",
    name: "Commande Agent",
    kind: "llm-small",
    budgetPerCallUsd: 0.005,
    role: "Free text/voice note → structured cart against cached catalog",
  },
  adresse: {
    id: "adresse",
    name: "Adresse Agent",
    kind: "llm-stt",
    budgetPerCallUsd: 0.006,
    role: "Adresse Vocale → Landmark Graph node + rendered address",
  },
  lipa: {
    id: "lipa",
    name: "Lipa Agent",
    kind: "regex-vision",
    budgetPerCallUsd: 0.0002,
    role: "SMS Ledger Bridge parsing and payment↔order matching",
  },
  "cuisine-sync": {
    id: "cuisine-sync",
    name: "Cuisine Sync",
    kind: "deterministic-tts",
    budgetPerCallUsd: 0.008,
    role: "Restaurant state machine; TTS voice-call escalation only",
  },
  "wewa-dispatch": {
    id: "wewa-dispatch",
    name: "Wewa Dispatch",
    kind: "algorithmic",
    budgetPerCallUsd: 0,
    role: "Zone assignment, batching, milestone scheduler",
  },
  litige: {
    id: "litige",
    name: "Litige Agent",
    kind: "llm-small",
    budgetPerCallUsd: 0.01,
    budgetPerOrderUsd: 0.01,
    role: "Disputes, refunds to Crédit Tunakula, photo evidence intake",
  },
  "mama-upsell": {
    id: "mama-upsell",
    name: "Mama Upsell",
    kind: "llm-single-shot",
    budgetPerCallUsd: 0.004,
    role: "Exactly one contextual upsell at cart confirmation",
  },
  seo: {
    id: "seo",
    name: "SEO Agent",
    kind: "llm-single-shot",
    // One post's prose is the only metered cost; the link graph, schema,
    // sitemap and meta tags are deterministic (0 tokens). Cap covers a
    // ~1200-word draft on a small model.
    budgetPerCallUsd: 0.02,
    role: "Autopilot blog content with dynamic internal links + SEO metadata",
  },
  growth: {
    id: "growth",
    name: "Growth Engine",
    kind: "llm-single-shot",
    // Partner marketing generators (post/advert/email/landing/video).
    // Analytics, timing, hashtags and audience tools are deterministic
    // (0 tokens). Cap covers one generation on a small model.
    budgetPerCallUsd: 0.01,
    role: "Partner AI marketing suite: content generators + growth analytics",
  },
};

/** Pilot exit criteria (§2.3): blended per-order cost ceilings. */
export const AI_COST_CEILING_PER_ORDER_USD = 0.05;
export const WA_COST_CEILING_PER_ORDER_USD = 0.024;
/** Rest-of-Africa utility template rate used for meters (FR-M2). */
export const WA_UTILITY_TEMPLATE_USD = 0.008;
