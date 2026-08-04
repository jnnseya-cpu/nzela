import { describe, expect, it } from "vitest";
import { MemoryLedger } from "@nzela/ledger";
import {
  campaignAnalytics,
  bestPostingTimes,
  generateHashtags,
  GrowthEngine,
  optimiseAudience,
  performanceRecommendations,
  type EngagementRecord,
  type Generator,
  type PartnerBrief,
} from "./index.js";

const brief: PartnerBrief = {
  restaurantName: "Mama Kito",
  quartier: "Bandal",
  highlights: ["Poulet mayo", "Thomson braisé"],
  lang: "fr",
  waLink: "https://wa.me/243000000000?text=Nakolia",
};

const records: EngagementRecord[] = [
  { channel: "facebook", postedAt: "2026-07-06T19:00", impressions: 1000, clicks: 40, orders: 8, spendUsd: 4 },
  { channel: "facebook", postedAt: "2026-07-06T12:00", impressions: 800, clicks: 10, orders: 1, spendUsd: 4 },
  { channel: "instagram", postedAt: "2026-07-07T20:00", impressions: 600, clicks: 30, orders: 6, spendUsd: 1.5 },
  { channel: "whatsapp-status", postedAt: "2026-07-07T19:00", impressions: 300, clicks: 60, orders: 12, spendUsd: 0 },
];

describe("deterministic growth tools (0 tokens)", () => {
  it("hashtags: builds from dishes + quartier + locale, deduped and clean", () => {
    const tags = generateHashtags(brief);
    expect(tags).toContain("#poulet");
    expect(tags).toContain("#bandal");
    expect(tags.every((t) => t.startsWith("#") && !t.includes(" "))).toBe(true);
    expect(new Set(tags).size).toBe(tags.length); // no dupes
  });

  it("best posting time: ranks the highest-converting slot first", () => {
    const slots = bestPostingTimes(records, { top: 2 });
    // whatsapp-status 19h converts 12/300 = 0.04, the best.
    expect(slots[0]).toMatchObject({ hour: 19 });
    expect(slots[0]!.score).toBeGreaterThan(slots[1]!.score);
  });

  it("campaign analytics: aggregates CTR, conversion, cost/order per channel", () => {
    const a = campaignAnalytics(records);
    expect(a.orders).toBe(27);
    expect(a.spendUsd).toBeCloseTo(9.5);
    expect(a.costPerOrderUsd).toBeCloseTo(9.5 / 27, 4);
    expect(a.byChannel["whatsapp-status"]!.costPerOrderUsd).toBe(0);
    expect(a.byChannel["facebook"]!.costPerOrderUsd).toBeCloseTo(8 / 9, 3);
  });

  it("performance recommendations: names the worst and best channel", () => {
    const recos = performanceRecommendations(records, 0.5);
    const text = recos.map((r) => r.message).join(" ");
    expect(text).toContain("facebook"); // worst cost/order → action
    expect(text).toContain("whatsapp-status"); // best → info
    expect(recos.some((r) => r.severity === "action")).toBe(true);
  });

  it("performance recommendations: zero orders → single actionable alert", () => {
    const recos = performanceRecommendations([
      { channel: "x", postedAt: "2026-07-06T19:00", impressions: 500, clicks: 5, orders: 0, spendUsd: 3 },
    ]);
    expect(recos).toHaveLength(1);
    expect(recos[0]!.severity).toBe("action");
  });

  it("audience optimisation: shares budget toward cheaper channels, sums to 1", () => {
    const s = optimiseAudience(records);
    const total = s.reduce((sum, x) => sum + x.recommendedShare, 0);
    expect(total).toBeCloseTo(1, 5);
    // whatsapp-status (cost 0 → infinite weight) gets the largest share.
    const top = [...s].sort((a, b) => b.recommendedShare - a.recommendedShare)[0];
    expect(top!.channel).toBe("whatsapp-status");
  });
});

describe("GrowthEngine — LLM generators under budget (agent #10)", () => {
  const goodGen: Generator = {
    async generate(req) {
      return {
        tool: req.tool,
        channel: req.channel,
        title: "Titre",
        body: `Contenu ${req.tool} pour ${req.brief.restaurantName}`,
        hashtags: ["#bandal"],
        costUsd: 0.008,
      };
    },
  };

  it("generates content and meters the cost under the growth budget", async () => {
    const ledger = new MemoryLedger();
    const engine = new GrowthEngine(goodGen, ledger);
    const out = await engine.generate({ tool: "social-post", brief, channel: "instagram" });
    expect(out.body).toContain("Mama Kito");
    const ai = ledger.events.find((e) => e.agent === "growth" && e.type === "ai");
    expect(ai?.costUsd).toBeCloseTo(0.008);
  });

  it("degrades to a deterministic fallback when the generator overspends", async () => {
    const greedy: Generator = {
      async generate(req) {
        return { tool: req.tool, body: "x", costUsd: 999, channel: req.channel };
      },
    };
    const ledger = new MemoryLedger();
    const engine = new GrowthEngine(greedy, ledger);
    const out = await engine.generate({ tool: "advert", brief });
    expect(out.costUsd).toBe(0); // fallback
    expect(out.body).toContain("Mama Kito");
    expect(ledger.events.some((e) => e.type === "budget-exhausted")).toBe(true);
  });

  it("degrades to fallback when the provider throws — never a blank dashboard", async () => {
    const broken: Generator = {
      async generate() {
        throw new Error("provider 503");
      },
    };
    const engine = new GrowthEngine(broken, new MemoryLedger());
    const out = await engine.generate({ tool: "email-campaign", brief });
    expect(out.body).toContain("Mama Kito");
  });

  it("refuses to run a deterministic tool through the LLM path", async () => {
    const engine = new GrowthEngine(goodGen, new MemoryLedger());
    await expect(engine.generate({ tool: "hashtags", brief })).rejects.toThrow(
      /deterministic/,
    );
    expect(engine.isDeterministic("campaign-analytics")).toBe(true);
    expect(engine.isDeterministic("social-post")).toBe(false);
  });

  it("deterministic tool calls are ledgered at zero cost", async () => {
    const ledger = new MemoryLedger();
    const engine = new GrowthEngine(goodGen, ledger);
    engine.hashtags(brief);
    engine.analytics(records);
    const det = ledger.events.filter((e) => e.agent === "growth" && e.type === "deterministic");
    expect(det.length).toBe(2);
    expect(det.every((e) => e.costUsd === 0)).toBe(true);
  });
});
