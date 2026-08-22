import type { ConversionEvent, ConversionSink, FetchLike, SinkResult } from "./types.js";
import { configured, hashPii, hashPhone, defaultFetch } from "./util.js";

export interface MetaCapiConfig {
  pixelId: string;
  accessToken: string;
  apiVersion?: string; // default v19.0
  testEventCode?: string; // Events Manager "Test events" tab
  actionSource?: string; // default "system_generated"
  fetchImpl?: FetchLike;
}

/** Meta Conversions API sink. Sends hashed user data; inert until configured. */
export class MetaCapiSink implements ConversionSink {
  readonly name = "meta-capi";
  constructor(private readonly cfg: MetaCapiConfig) {}

  configured(): boolean {
    return configured(this.cfg.pixelId) && configured(this.cfg.accessToken);
  }

  async send(event: ConversionEvent): Promise<SinkResult> {
    if (!this.configured()) return { sink: this.name, ok: true, skipped: true };
    const fetchImpl = this.cfg.fetchImpl ?? defaultFetch;
    const v = this.cfg.apiVersion ?? "v19.0";
    const u = event.user ?? {};

    const userData: Record<string, unknown> = {
      ph: hashPhone(u.phone),
      em: hashPii(u.email),
      external_id: hashPii(u.externalId),
      client_ip_address: u.clientIpAddress,
      client_user_agent: u.userAgent,
      fbp: u.fbp,
      fbc: u.fbc,
    };
    for (const k of Object.keys(userData)) if (userData[k] == null) delete userData[k];

    const custom_data: Record<string, unknown> = { ...event.custom };
    if (event.value != null) custom_data.value = event.value;
    if (event.currency) custom_data.currency = event.currency;
    if (event.tkRef) custom_data.order_id = event.tkRef;

    const body = {
      data: [
        {
          event_name: event.name,
          event_time: Math.floor(event.at / 1000),
          event_id: event.eventId, // dedup with the browser pixel
          action_source: this.cfg.actionSource ?? "system_generated",
          user_data: userData,
          custom_data,
        },
      ],
      ...(this.cfg.testEventCode ? { test_event_code: this.cfg.testEventCode } : {}),
    };

    const url =
      `https://graph.facebook.com/${v}/${this.cfg.pixelId}/events` +
      `?access_token=${encodeURIComponent(this.cfg.accessToken)}`;
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
