import { describe, it, expect } from "vitest";
import { EffectiveBriefResolver, type BriefScope } from "./sdk.js";
import { GROWTH_BRIEF_FIXTURE, INSIDE_WINDOW_MS, AFTER_EXPIRY_MS } from "./fixtures.js";
import type { GrowthBrief } from "./brief.js";

const scope: BriefScope = {
  tenant_id: "tenant_demo", platform_id: "fixture_platform_a",
  market: "CA", locale: "en-CA", channel: "seo", topic_id: "simpler-team-onboarding",
};

describe("EffectiveBriefResolver (§4/§14)", () => {
  it("resolves a live approved brief", async () => {
    const r = new EffectiveBriefResolver({ fetchApproved: async () => GROWTH_BRIEF_FIXTURE });
    const res = await r.resolve(scope, INSIDE_WINDOW_MS);
    expect(res.source).toBe("brief");
  });

  it("falls back to baseline when there is no approved brief", async () => {
    const r = new EffectiveBriefResolver({ fetchApproved: async () => undefined });
    expect((await r.resolve(scope, INSIDE_WINDOW_MS)).source).toBe("baseline");
  });

  it("falls back to baseline on fetch error (timeout)", async () => {
    const r = new EffectiveBriefResolver({ fetchApproved: async () => { throw new Error("timeout"); } });
    const res = await r.resolve(scope, INSIDE_WINDOW_MS);
    expect(res).toEqual({ source: "baseline", reason: "error" });
  });

  it("never serves a cached brief past its expiry", async () => {
    let calls = 0;
    const r = new EffectiveBriefResolver({
      fetchApproved: async () => { calls++; return GROWTH_BRIEF_FIXTURE; },
      cacheTtlMs: 60_000,
    });
    // warm cache inside window
    expect((await r.resolve(scope, INSIDE_WINDOW_MS)).source).toBe("brief");
    // after expiry → cache must not be used; refetch returns the (expired) brief → baseline
    const res = await r.resolve(scope, AFTER_EXPIRY_MS);
    expect(res).toEqual({ source: "baseline", reason: "expired" });
  });

  it("clamps the cache TTL to the 60s ceiling", async () => {
    let calls = 0;
    const r = new EffectiveBriefResolver({
      fetchApproved: async () => { calls++; return GROWTH_BRIEF_FIXTURE; },
      cacheTtlMs: 999_999, // asks for huge; must be clamped to 60s
    });
    await r.resolve(scope, INSIDE_WINDOW_MS);
    await r.resolve(scope, INSIDE_WINDOW_MS + 30_000); // within 60s → cache hit
    expect(calls).toBe(1);
    await r.resolve(scope, INSIDE_WINDOW_MS + 61_000); // beyond 60s → refetch
    expect(calls).toBe(2);
  });

  it("assertWritable never trusts the cache — it re-fetches live", async () => {
    // fetch returns a brief that is expired at write time → must refuse
    const expired: GrowthBrief = { ...GROWTH_BRIEF_FIXTURE };
    const r = new EffectiveBriefResolver({ fetchApproved: async () => expired });
    await r.resolve(scope, INSIDE_WINDOW_MS); // caches a live brief
    const w = await r.assertWritable(scope, AFTER_EXPIRY_MS);
    expect(w.ok).toBe(false);
  });
});
