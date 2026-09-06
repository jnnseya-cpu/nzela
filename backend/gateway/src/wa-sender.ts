import type { WhatsAppSender } from "./server.js";

/**
 * Real WhatsApp Cloud API sender — the outbound half of the front door.
 * Implements the `WhatsAppSender` port by POSTing to
 * `graph.facebook.com/<version>/<phoneNumberId>/messages`. This is the one
 * file that turns every canned/engine reply into an actual message on the
 * customer's phone; it runs unchanged in production the moment the access
 * token + phone-number id arrive.
 *
 * Fully testable: `fetch` is injected, so the whole gateway can be exercised
 * end-to-end with a mock and no network. Failures throw with the Graph error
 * body (truncated) so the caller/ledger can see why a send failed.
 */

export interface CloudApiConfig {
  /** WhatsApp Business phone-number ID (NOT the phone number itself). */
  phoneNumberId: string;
  /** Permanent System-User access token (whatsapp_business_messaging). */
  accessToken: string;
  /** Graph API version, e.g. "v21.0". */
  graphVersion?: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class CloudApiSender implements WhatsAppSender {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: CloudApiConfig) {
    const version = config.graphVersion ?? "v21.0";
    this.base = `https://graph.facebook.com/${version}/${config.phoneNumberId}/messages`;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async sendText(waId: string, body: string): Promise<void> {
    const res = await this.fetchImpl(this.base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        // Graph expects the E.164 number without a leading "+".
        to: waId.replace(/^\+/, ""),
        type: "text",
        text: { preview_url: false, body },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(
        `WhatsApp send failed ${res.status}: ${errBody.slice(0, 200)}`,
      );
    }
  }
}

/**
 * A sender that logs instead of sending — the safe default before a live
 * token exists, so a misconfigured deploy degrades to visible logs rather
 * than crashing the inbound webhook. Never used once `WA_ACCESS_TOKEN` is set.
 */
export class ConsoleSender implements WhatsAppSender {
  constructor(private readonly log: (msg: string) => void = console.log) {}
  async sendText(waId: string, body: string): Promise<void> {
    this.log(`[wa→${waId}] ${body.replace(/\n/g, " ⏎ ")}`);
  }
}
