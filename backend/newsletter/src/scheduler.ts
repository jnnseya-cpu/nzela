import type { LedgerSink } from "@nzela/ledger";
import type {
  Edition,
  EmailSender,
  NewsletterConfig,
  NewsletterItem,
  SentLog,
  Subscriber,
} from "./types.js";
import { FEATURE_CATALOG } from "./catalog.js";
import { composeEmail } from "./compose.js";
import { mailableSubscribers } from "./subscribers.js";

/**
 * Weekly newsletter scheduler. Runs once per ISO week (cron/Cloud
 * Scheduler at deploy). Per operating directives it is:
 *  - deterministic (0 tokens / 0 ACU),
 *  - idempotent — a subscriber is never emailed twice for the same week
 *    (SentLog), so a re-run or retry can't double-send,
 *  - resilient — one failing recipient never aborts the batch,
 *  - consent-enforcing — only mailable subscribers are contacted.
 */

/** ISO week key like "2026-W33" from an injected date (no hidden clock). */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Build the edition for a given week: a rotating window over the catalog so
 * each week highlights different features (fresh content, all still linked
 * over time). Rotation is deterministic in the week number.
 */
export function buildEdition(
  weekIso: string,
  lang: "fr" | "en",
  itemsPerEdition: number,
  catalog: readonly NewsletterItem[] = FEATURE_CATALOG,
): Edition {
  const n = catalog.length;
  const count = Math.min(itemsPerEdition, n);
  const weekNum = Number(weekIso.split("-W")[1] ?? "0");
  const start = ((weekNum - 1) * count) % n;
  const items: NewsletterItem[] = [];
  for (let i = 0; i < count; i++) items.push(catalog[(start + i) % n]!);
  return {
    weekIso,
    lang,
    subject: `Tunakula — ${items[0]!.title} (et plus) cette semaine`,
    items,
  };
}

export interface SendReport {
  weekIso: string;
  attempted: number;
  sent: number;
  skippedAlreadySent: number;
  skippedNotMailable: number;
  failed: { email: string; error: string }[];
}

export class NewsletterScheduler {
  constructor(
    private readonly cfg: NewsletterConfig,
    private readonly sender: EmailSender,
    private readonly sentLog: SentLog,
    private readonly ledger: LedgerSink,
  ) {}

  /**
   * Send this week's newsletter to all mailable subscribers. `now` is
   * injected so the run is deterministic/testable.
   */
  async runWeekly(
    subscribers: readonly Subscriber[],
    now: Date,
  ): Promise<SendReport> {
    const weekIso = isoWeek(now);
    const mailable = mailableSubscribers(subscribers);
    const report: SendReport = {
      weekIso,
      attempted: 0,
      sent: 0,
      skippedAlreadySent: 0,
      skippedNotMailable: subscribers.length - mailable.length,
      failed: [],
    };

    for (const sub of mailable) {
      if (this.sentLog.wasSent(sub.email, weekIso)) {
        report.skippedAlreadySent++;
        continue;
      }
      const edition = buildEdition(weekIso, sub.lang, this.cfg.itemsPerEdition);
      const email = composeEmail(edition, sub, this.cfg);
      report.attempted++;
      try {
        await this.sender.send({
          to: sub.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        // Mark sent only AFTER a successful send → a failure can be retried
        // next run without having been silently marked delivered.
        this.sentLog.markSent(sub.email, weekIso);
        report.sent++;
      } catch (err) {
        report.failed.push({ email: sub.email, error: String(err).slice(0, 120) });
      }
    }

    this.ledger.write({
      type: "lifecycle",
      agent: "growth",
      purpose: `newsletter ${weekIso}: sent ${report.sent}/${report.attempted}, ${report.failed.length} failed`,
      costUsd: 0,
      at: new Date(),
    });
    return report;
  }
}
