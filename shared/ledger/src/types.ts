/**
 * Ledger event model — the prototype's "Registre NZELA" is the spec (NFR
 * Observability, FR-A1). Every AI action, deterministic step, firewall block
 * and WhatsApp message cost is one event, keyed to an order where possible.
 */

export type AgentId =
  | "router"
  | "commande"
  | "adresse"
  | "lipa"
  | "cuisine-sync"
  | "wewa-dispatch"
  | "litige"
  | "mama-upsell"
  | "seo"
  | "growth"
  | "sentinelle";

export type LedgerEventType =
  /** Zero-token deterministic step (button, rule, state machine). */
  | "deterministic"
  /** Metered LLM/STT/TTS invocation. */
  | "ai"
  /** AI firewall refused an LLM call (FR-A3). */
  | "block"
  /** Budget cap reached — degraded to deterministic fallback (FR-A1). */
  | "budget-exhausted"
  /** AI action refused: no ACU balance to cover it (no free AI, ever). */
  | "acu-gated"
  /** WhatsApp message cost event (FR-M4). */
  | "wa-message"
  /** Order lifecycle / exception-ladder event (FR-K3). */
  | "lifecycle";

export interface LedgerEvent {
  type: LedgerEventType;
  agent: AgentId | "system";
  /** Human-readable purpose, e.g. "free text → structured cart". */
  purpose: string;
  /** USD cost of this event; 0 for deterministic/block events. */
  costUsd: number;
  /** NZELA short ref (TK-xxx) when the event belongs to an order. */
  tkRef?: string;
  /** StackFood order id once known. */
  stackfoodOrderId?: number;
  at: Date;
  meta?: Record<string, unknown>;
}

/** Pluggable sink — Postgres writer in production, array in tests. */
export interface LedgerSink {
  write(event: LedgerEvent): void;
}

export class MemoryLedger implements LedgerSink {
  readonly events: LedgerEvent[] = [];
  write(event: LedgerEvent): void {
    this.events.push(event);
  }
}
