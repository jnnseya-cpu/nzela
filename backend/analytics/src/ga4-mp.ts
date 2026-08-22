import type { ConversionEvent, ConversionSink, FetchLike, SinkResult } from "./types.js";
import { configured, ga4ClientId, defaultFetch } from "./util.js";

export interface Ga4Config {
  measurementId: string; // G-XXXXXXXXXX
  apiSecret: string;
  fetchImpl?: FetchLike;
}

/** Canonical → GA4 recommended event names. */
const GA4_NAME: Record<string, string> = {
  Purchase: "purchase",
  Lead: "generate_lead",
  InitiateCheckout: "begin_checkout",
  CompleteRegistration: "sign_up",
  Contact: "whatsapp_click",
};

/** GA4 Measurement Protocol sink. Inert until configured. */
export class Ga4Sink implements ConversionSink {
  readonly name = "ga4-mp";
  constructor(private readonly cfg: Ga4Config) {}

  configured(): boolean {
    return configured(this.cfg.measurementId) && configured(this.cfg.apiSecret);
  }

  async send(event: ConversionEvent): Promise<SinkResult> {
    if (!this.configured()) return { sink: this.name, ok: true, skipped: true };
    const fetchImpl = this.cfg.fetchImpl ?? defaultFetch;

    const seed = event.user?.externalId ?? event.tkRef ?? event.eventId;
    const params: Record<string, unknown> = { ...event.custom, engagement_time_msec: 1 };
    if (event.value != null) params.value = event.value;
    if (event.currency) params.currency = event.currency;
    if (event.tkRef) params.transaction_id = event.tkRef;

    const body = {
      client_id: ga4ClientId(seed),
      timestamp_micros: event.at * 1000,
      non_personalized_ads: false,
      events: [{ name: GA4_NAME[event.name] ?? "custom_conversion", params }],
    };

    const url =
      `https://www.google-analytics.com/mp/collect` +
      `?measurement_id=${encodeURIComponent(this.cfg.measurementId)}` +
      `&api_secret=${encodeURIComponent(this.cfg.apiSecret)}`;
    try {
      const r = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return {
        sink: this.name,
        ok: r.ok,
        status: r.status,
        error: r.ok ? undefined : (await r.text()).slice(0, 200),
      };
    } catch (e) {
      return { sink: this.name, ok: false, error: String(e).slice(0, 200) };
    }
  }
}
