import { describe, it, expect } from "vitest";
import {
  validateGrowthBrief, checkBriefWindow, isBriefLive, briefAllowsChannel,
} from "./brief.js";
import { GROWTH_BRIEF_FIXTURE, INSIDE_WINDOW_MS, AFTER_EXPIRY_MS } from "./fixtures.js";

describe("Growth Brief v1 validation (Appendix A)", () => {
  it("accepts the canonical §6 fixture", () => {
    const r = validateGrowthBrief(GROWTH_BRIEF_FIXTURE);
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown field (closed object)", () => {
    const r = validateGrowthBrief({ ...GROWTH_BRIEF_FIXTURE, sneaky: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/unknown field rejected: sneaky/);
  });

  it("rejects a missing required field", () => {
    const { market, ...rest } = GROWTH_BRIEF_FIXTURE;
    void market;
    const r = validateGrowthBrief(rest);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/missing required field: market/);
  });

  it("enforces market pattern, score range, utc format, channel enum", () => {
    expect(validateGrowthBrief({ ...GROWTH_BRIEF_FIXTURE, market: "can" }).ok).toBe(false);
    expect(validateGrowthBrief({ ...GROWTH_BRIEF_FIXTURE, opportunity_score: 120 }).ok).toBe(false);
    expect(validateGrowthBrief({ ...GROWTH_BRIEF_FIXTURE, valid_from: "2026-11-10 10:00" }).ok).toBe(false);
    expect(validateGrowthBrief({ ...GROWTH_BRIEF_FIXTURE, allowed_channels: ["telepathy"] }).ok).toBe(false);
    expect(validateGrowthBrief({ ...GROWTH_BRIEF_FIXTURE, evidence_ids: [] }).ok).toBe(false); // minItems 1
  });

  it("enforces the time window (§507)", () => {
    expect(checkBriefWindow(GROWTH_BRIEF_FIXTURE, INSIDE_WINDOW_MS)).toBe("valid");
    expect(checkBriefWindow(GROWTH_BRIEF_FIXTURE, AFTER_EXPIRY_MS)).toBe("expired");
    expect(checkBriefWindow(GROWTH_BRIEF_FIXTURE, Date.parse("2026-11-09T00:00:00Z"))).toBe("not_yet_valid");
    const bad = { ...GROWTH_BRIEF_FIXTURE, valid_from: "2026-11-20T10:00:00Z" };
    expect(checkBriefWindow(bad, INSIDE_WINDOW_MS)).toBe("bad_window");
    expect(isBriefLive(GROWTH_BRIEF_FIXTURE, INSIDE_WINDOW_MS)).toBe(true);
    expect(isBriefLive(GROWTH_BRIEF_FIXTURE, AFTER_EXPIRY_MS)).toBe(false);
  });

  it("checks channel membership", () => {
    expect(briefAllowsChannel(GROWTH_BRIEF_FIXTURE, "seo")).toBe(true);
    expect(briefAllowsChannel(GROWTH_BRIEF_FIXTURE, "paid")).toBe(false);
  });
});
