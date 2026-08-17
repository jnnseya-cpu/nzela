import { describe, expect, it } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import {
  buildEdition,
  composeEmail,
  FEATURE_CATALOG,
  isoWeek,
  mailableSubscribers,
  MemorySentLog,
  NewsletterScheduler,
  unsubscribeToken,
  verifyUnsubscribe,
  type EmailSender,
  type NewsletterConfig,
  type Subscriber,
} from "./index.js";

const cfg: NewsletterConfig = {
  baseUrl: "https://tunakula.com",
  waNumber: "447493216101",
  siteName: "Tunakula-Congo",
  unsubscribeSecret: "secret-xyz",
  itemsPerEdition: 6,
};

const subs: Subscriber[] = [
  { email: "a@x.com", name: "Amina", lang: "fr", consented: true },
  { email: "b@x.com", lang: "fr", consented: true },
  { email: "c@x.com", lang: "fr", consented: false }, // no consent
  { email: "d@x.com", lang: "fr", consented: true, unsubscribedAt: "2026-01-01" },
  { email: "not-an-email", lang: "fr", consented: true }, // invalid
];

describe("consent & unsubscribe (only humans who opted in)", () => {
  it("mails only valid, consented, non-unsubscribed addresses", () => {
    expect(mailableSubscribers(subs).map((s) => s.email)).toEqual(["a@x.com", "b@x.com"]);
  });
  it("unsubscribe tokens are signed and verifiable, not forgeable", () => {
    const t = unsubscribeToken("a@x.com", cfg.unsubscribeSecret);
    expect(verifyUnsubscribe("a@x.com", t, cfg.unsubscribeSecret)).toBe(true);
    expect(verifyUnsubscribe("a@x.com", t, "wrong-secret")).toBe(false);
    expect(verifyUnsubscribe("a@x.com", "forged", cfg.unsubscribeSecret)).toBe(false);
  });
});

describe("edition & composition", () => {
  it("ISO week is deterministic", () => {
    expect(isoWeek(new Date("2026-08-13T10:00:00Z"))).toMatch(/^2026-W\d{2}$/);
  });
  it("rotates featured items week to week (fresh content)", () => {
    const w1 = buildEdition("2026-W01", "fr", 6).items.map((i) => i.slug);
    const w2 = buildEdition("2026-W02", "fr", 6).items.map((i) => i.slug);
    expect(w1).not.toEqual(w2);
    expect(w1).toHaveLength(6);
  });
  it("composes an email dense with working hyperlinks + unsubscribe", () => {
    const ed = buildEdition("2026-W33", "fr", 6);
    const email = composeEmail(ed, subs[0]!, cfg);
    // 6 feature links + CTA + blog + referral + logo + unsubscribe ≥ 10.
    expect(email.linkCount).toBeGreaterThanOrEqual(10);
    expect(email.html).toContain("wa.me/447493216101");
    expect(email.html).toContain("/blog/");
    expect(email.html).toContain("/newsletter/unsubscribe?e=");
    expect(email.text).toContain("Se désabonner");
    for (const it of ed.items) expect(email.html).toContain(`/blog/${it.slug}`);
  });
});

describe("weekly scheduler — idempotent & resilient", () => {
  const okSender = (): { sender: EmailSender; sent: string[] } => {
    const sent: string[] = [];
    return { sender: { async send(m) { sent.push(m.to); } }, sent };
  };

  it("sends to every mailable subscriber once", async () => {
    const { sender, sent } = okSender();
    const s = new NewsletterScheduler(cfg, sender, new MemorySentLog(), new MemoryLedger());
    const r = await s.runWeekly(subs, new Date("2026-08-13T09:00:00Z"));
    expect(sent.sort()).toEqual(["a@x.com", "b@x.com"]);
    expect(r.sent).toBe(2);
    expect(r.skippedNotMailable).toBe(3);
  });

  it("never double-sends the same week (idempotent re-run)", async () => {
    const { sender, sent } = okSender();
    const log = new MemorySentLog();
    const s = new NewsletterScheduler(cfg, sender, log, new MemoryLedger());
    const now = new Date("2026-08-13T09:00:00Z");
    await s.runWeekly(subs, now);
    const second = await s.runWeekly(subs, now); // re-run same week
    expect(sent).toHaveLength(2); // no extra sends
    expect(second.sent).toBe(0);
    expect(second.skippedAlreadySent).toBe(2);
  });

  it("one failing recipient does not abort the batch; failure is retryable", async () => {
    let calls = 0;
    const flaky: EmailSender = {
      async send(m) {
        calls++;
        if (m.to === "a@x.com" && calls === 1) throw new Error("provider 500");
      },
    };
    const log = new MemorySentLog();
    const s = new NewsletterScheduler(cfg, flaky, log, new MemoryLedger());
    const now = new Date("2026-08-13T09:00:00Z");
    const r1 = await s.runWeekly(subs, now);
    expect(r1.sent).toBe(1); // b@x.com went; a@x.com failed
    expect(r1.failed.map((f) => f.email)).toEqual(["a@x.com"]);
    // a@x.com was NOT marked sent, so a re-run retries just that one.
    const r2 = await s.runWeekly(subs, now);
    expect(r2.sent).toBe(1);
    expect(r2.failed).toEqual([]);
  });

  it("sends nothing when there are no mailable subscribers", async () => {
    const { sender, sent } = okSender();
    const s = new NewsletterScheduler(cfg, sender, new MemorySentLog(), new MemoryLedger());
    const r = await s.runWeekly([subs[2]!, subs[3]!, subs[4]!], new Date("2026-08-13T09:00:00Z"));
    expect(sent).toEqual([]);
    expect(r.sent).toBe(0);
  });

  it("catalog slugs stay in sync with the blog (12 features)", () => {
    expect(FEATURE_CATALOG).toHaveLength(12);
    expect(new Set(FEATURE_CATALOG.map((i) => i.slug)).size).toBe(12);
  });
});
