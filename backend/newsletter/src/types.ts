/**
 * Weekly newsletter to registered users. Deterministic (0 tokens / 0 ACU):
 * it assembles feature links into an email — no LLM needed, so it never
 * touches the AI budget. Consent and unsubscribe are enforced, not
 * optional (legal + trust).
 */

export type Lang = "fr" | "en";

export interface Subscriber {
  email: string;
  name?: string;
  lang: Lang;
  /** Explicit marketing consent. No consent → never emailed. */
  consented: boolean;
  /** Set when the user unsubscribed; excluded from every send thereafter. */
  unsubscribedAt?: string;
}

/** One feature/link block in the newsletter — sourced from the blog. */
export interface NewsletterItem {
  title: string;
  blurb: string;
  /** Blog slug; the URL is built as `${baseUrl}/blog/${slug}`. */
  slug: string;
}

export interface NewsletterConfig {
  baseUrl: string; // e.g. https://tunakula.com
  waNumber: string; // digits only, e.g. 447493216101
  siteName: string;
  /** Secret for signing unsubscribe tokens (server-side only). */
  unsubscribeSecret: string;
  /** How many feature items to feature per edition. */
  itemsPerEdition: number;
}

export interface Edition {
  weekIso: string; // e.g. "2026-W33"
  subject: string;
  items: NewsletterItem[];
  lang: Lang;
}

/** Email transport port — real provider (Brevo/SendGrid) wired at deploy. */
export interface EmailSender {
  send(msg: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void>;
}

/** Idempotency store: has this address already received this week's issue? */
export interface SentLog {
  wasSent(email: string, weekIso: string): boolean;
  markSent(email: string, weekIso: string): void;
}

export class MemorySentLog implements SentLog {
  private readonly seen = new Set<string>();
  private key(e: string, w: string) {
    return `${e.toLowerCase()}::${w}`;
  }
  wasSent(email: string, weekIso: string): boolean {
    return this.seen.has(this.key(email, weekIso));
  }
  markSent(email: string, weekIso: string): void {
    this.seen.add(this.key(email, weekIso));
  }
}
