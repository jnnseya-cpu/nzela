/**
 * LLM agent implementations — agents 2 (Commande), 3 (Adresse), 7 (Litige),
 * 8 (Mama Upsell) — will live here, built on LangGraph and always invoked
 * through the ledger's BudgetMiddleware (FR-A1). Phase 2 of the delivery
 * plan.
 *
 * The contracts below are the interfaces the gateway codes against today.
 * The deterministic fallbacks that let the order loop ship in Phase 1
 * without any LLM in the path live in the gateway router (backend/gateway),
 * NOT in this package — this package ships interfaces only until Phase 2.
 */

import type { LandmarkAddress } from "@nzela/landmark-graph";

export interface ParsedCartItem {
  /** Raw item name as understood — resolved to product_id via
   *  /products/search by the Order Adapter, never by the LLM. */
  name: string;
  quantity: number;
  modifiers: string[];
}

export interface CommandeResult {
  items: ParsedCartItem[];
  /** Auto-selected nearest restaurant that has everything (FR-D4). */
  restaurantHint?: string;
}

export interface CommandeAgent {
  parse(text: string, tkRef?: string): Promise<CommandeResult>;
}

export interface AdresseAgent {
  /** Voice-note transcript or free text → landmark address (FR-L2). */
  parse(text: string, tkRef?: string): Promise<LandmarkAddress>;
}

export interface UpsellAgent {
  /** Exactly one contextual upsell at cart confirmation (FR-O2). */
  suggest(cartSummary: string, tkRef: string): Promise<string | undefined>;
}

export interface LitigeAgent {
  open(tkRef: string, complaint: string): Promise<{
    resolution: "refund-credit" | "reroute" | "ops-escalation";
    customerMessage: string;
  }>;
}
