import { describe, it, expect } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import {
  NZELA_PROFILE, TrendCoordinator, type NzelaSignal,
  briefToSeoDirective, briefToMarketingDirective, applyBriefToPartnerBrief,
  type AssessContext,
} from "./index.js";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const HOUR = 3_600_000;

/** A burst of real NZELA first-party signals for one topic. */
function paymentBurst(topic: string, n: number): NzelaSignal[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: "payment_verified" as const,
    topic,
    atMs: NOW - i * 60_000,
    dedupKey: `TK-${topic}-${i}`,
    market: "CD",
  }));
}

const ctx = (over: Partial<AssessContext> = {}): AssessContext => ({
  nowMs: NOW,
  baselineCount: 4,
  history: [3, 4, 5, 4, 3, 4],
  freshnessMs: 24 * HOUR,
  timing: 90,
  readiness: 90,
  ...over,
});

describe("NZELA embedding: signals → coordinator → brief", () => {
  it("a strong first-party demand burst (+ a 2nd family) yields a reviewable Growth Brief", () => {
    const ledger = new MemoryLedger();
    const coord = new TrendCoordinator(NZELA_PROFILE, ledger);
    const topic = "mobile-money-paiement";
    // weighted demand: 10 verified payments × 3 = 30 (≥20 count gate)
    for (const s of paymentBurst(topic, 10)) coord.record(s);
    // a second independent family (search intents) → corroboration ≥ 2 families
    coord.record({ kind: "conversation_intent", topic, atMs: NOW - HOUR, dedupKey: "q1", market: "CD" });
    coord.record({ kind: "conversation_intent", topic, atMs: NOW - 2 * HOUR, dedupKey: "q2", market: "CD" });

    const out = coord.buildBrief(topic, {
      ctx: ctx(),
      briefId: "gb_mm_1", briefVersion: 1, tenantId: "nzela_tunakula",
      evidenceIds: ["ev_mm_1", "ev_mm_2"], policyVersion: 1, experimentId: "exp_mm_1",
    });

    expect(out.assessment.gatePassed).toBe(true);
    expect(out.assessment.independentFamilies).toBeGreaterThanOrEqual(2);
    expect(out.assessment.decision).toBe("reviewable_brief");
    expect(out.brief).not.toBeNull();
    expect(out.brief!.market).toBe("CD");
    expect(out.brief!.locale).toBe("fr-CD");
    expect(out.brief!.topic_id).toBe(topic);
    expect(out.brief!.approved_claim_ids).toContain("claim_mobile_money");
    expect(ledger.events.at(-1)?.purpose).toMatch(/trend assess/);
  });

  it("a single source family is capped and does NOT produce a brief", () => {
    const coord = new TrendCoordinator(NZELA_PROFILE);
    const topic = "plat-chaud-bandal";
    for (const s of paymentBurst(topic, 12)) coord.record(s); // one family only
    const out = coord.buildBrief(topic, {
      ctx: ctx(), briefId: "gb_pc_1", briefVersion: 1, tenantId: "nzela_tunakula",
      evidenceIds: ["ev_1"], policyVersion: 1, experimentId: "exp_1",
    });
    expect(out.assessment.confidence).toBeLessThanOrEqual(69); // single-family cap
    expect(out.assessment.decision).not.toBe("reviewable_brief");
    expect(out.brief).toBeNull();
  });

  it("a forbidden topic is vetoed — no brief even with strong demand", () => {
    const coord = new TrendCoordinator(NZELA_PROFILE);
    const topic = "politique"; // in profile.forbidden_topics
    for (const s of paymentBurst(topic, 20)) coord.record(s);
    const out = coord.buildBrief(topic, {
      ctx: ctx(), briefId: "gb_x", briefVersion: 1, tenantId: "nzela_tunakula",
      evidenceIds: ["ev_1"], policyVersion: 1, experimentId: "exp_1",
    });
    expect(out.assessment.vetoed).toBe(true);
    expect(out.brief).toBeNull();
  });
});

describe("NZELA embedding: brief controls the existing agents", () => {
  const coord = new TrendCoordinator(NZELA_PROFILE);
  const topic = "mobile-money-paiement";
  for (const s of paymentBurst(topic, 10)) coord.record(s);
  coord.record({ kind: "conversation_intent", topic, atMs: NOW - HOUR, dedupKey: "q1", market: "CD" });
  coord.record({ kind: "conversation_intent", topic, atMs: NOW - 2 * HOUR, dedupKey: "q2", market: "CD" });
  const built = coord.buildBrief(topic, {
    ctx: ctx(), briefId: "gb_mm_2", briefVersion: 2, tenantId: "nzela_tunakula",
    evidenceIds: ["ev_a", "ev_b"], policyVersion: 1, experimentId: "exp_2",
  });

  it("brief → SEO directive carries the target keyword + resolved approved claim TEXT", () => {
    expect(built.brief).not.toBeNull();
    const seo = briefToSeoDirective(built.brief!, NZELA_PROFILE);
    expect(seo.keyword).toBe("mobile money paiement");
    expect(seo.lang).toBe("fr");
    expect(seo.approvedClaims.some((c) => c.includes("Mobile money"))).toBe(true);
    expect(seo.prohibitedClaims).toContain("délai de livraison garanti");
    expect(seo.briefVersion).toBe(2);
  });

  it("brief → growth-engine PartnerBrief is adapted on-brief (highlights = approved claims)", () => {
    const partnerBase = { restaurantName: "Mama Kito", quartier: "Bandal", highlights: ["Poulet mayo"], lang: "fr" as const, waLink: "https://wa.me/243..." };
    const adapted = applyBriefToPartnerBrief(partnerBase, built.brief!, NZELA_PROFILE);
    expect(adapted.highlights[0]).toMatch(/Mobile money/); // brief claim featured first
    expect(adapted.highlights).toContain("Poulet mayo"); // base preserved
    const md = briefToMarketingDirective(built.brief!, NZELA_PROFILE);
    expect(md.prohibitedClaims.length).toBeGreaterThan(0);
  });
});
