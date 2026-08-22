/**
 * Server-side conversion spine — unified event model for Meta Conversions
 * API (CAPI) and GA4 Measurement Protocol (MP). The real NZELA conversions
 * (a placed order, a verified payment) happen inside WhatsApp, not a
 * browser — so they are reported server-side from the money path, deduped
 * against the browser pixel by a shared `eventId`.
 */

/** Canonical conversion names (mapped per sink to Meta/GA4 vocabularies). */
export type ConversionName =
  | "Purchase" // paid order verified — the real money event
  | "Lead" // customer started a real order / first contact
  | "InitiateCheckout"
  | "CompleteRegistration"
  | "Contact"; // WhatsApp click

/** RAW user identifiers — hashed before they ever leave the process. */
export interface ConversionUser {
  phone?: string;
  email?: string;
  externalId?: string; // wa_id / customer id
  clientIpAddress?: string;
  userAgent?: string;
  fbp?: string; // Meta browser cookie, if forwarded
  fbc?: string;
}

export interface ConversionEvent {
  name: ConversionName;
  /** Shared with the browser pixel eventID for cross-source dedup. */
  eventId: string;
  /** Event time, epoch milliseconds. */
  at: number;
  value?: number;
  currency?: string; // ISO 4217, e.g. "CDF" or "USD"
  tkRef?: string; // NZELA order ref
  user?: ConversionUser;
  custom?: Record<string, string | number | boolean>;
}

export interface SinkResult {
  sink: string;
  ok: boolean;
  /** true when the sink is not configured (placeholder IDs) — a safe skip. */
  skipped?: boolean;
  status?: number;
  error?: string;
}

export interface ConversionSink {
  readonly name: string;
  send(event: ConversionEvent): Promise<SinkResult>;
}

/** Minimal fetch shape so tests can inject a mock without DOM/undici types. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
