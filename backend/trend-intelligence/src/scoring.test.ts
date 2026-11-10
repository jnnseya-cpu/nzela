import { describe, it, expect } from "vitest";
import {
  median, mad, logLift, robustZ, countFeedGate, demandFromZ,
  opportunityScore, confidenceScore, corroborationScore, decideBand,
} from "./scoring.js";

describe("robust statistics", () => {
  it("median handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
  it("mad is the median absolute deviation", () => {
    expect(mad([1, 1, 1, 1])).toBe(0);
    expect(mad([1, 2, 3, 4, 5])).toBe(1);
  });
});

describe("lift and robust z", () => {
  it("logLift = ln((c+1)/(b+1))", () => {
    expect(logLift(0, 0)).toBe(0);
    expect(logLift(9, 4)).toBeCloseTo(Math.log(10 / 5), 12);
  });
  it("z floors the denominator at 0.2 so tiny spreads don't explode", () => {
    const z = robustZ(100, [1, 1, 1, 1]); // MAD=0 → denom floored to 0.2
    expect(z).toBeCloseTo((Math.log1p(100) - Math.log1p(1)) / 0.2, 10);
  });
});

describe("count-feed gate (§5.3)", () => {
  it("passes on count≥20, z≥2 with ≥4 periods", () => {
    const r = countFeedGate(60, 10, [8, 9, 10, 11, 12]);
    expect(r.passed).toBe(true);
    expect(r.z).toBeGreaterThanOrEqual(2);
  });
  it("fails and flags insufficient history with <4 periods", () => {
    const r = countFeedGate(60, 10, [8, 9]);
    expect(r.passed).toBe(false);
    expect(r.insufficientHistory).toBe(true);
    expect(r.reasons.join(" ")).toMatch(/insufficient history/);
  });
  it("fails below the count threshold even with a high z", () => {
    const r = countFeedGate(5, 0, [0, 0, 0, 0]);
    expect(r.passed).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/count 5 < 20/);
  });
  it("demandFromZ = clamp(50 + 10z, 0, 100)", () => {
    expect(demandFromZ(0)).toBe(50);
    expect(demandFromZ(10)).toBe(100);
    expect(demandFromZ(-10)).toBe(0);
  });
});

describe("opportunity & confidence (§5.4/§5.5)", () => {
  it("opportunity score uses 25/25/20/15/15 weights", () => {
    const r = opportunityScore({ demand: 80, fit: 95, intent: 85, timing: 90, readiness: 80 });
    expect(r.score).toBe(86.25);
    expect(r.vetoed).toBe(false);
  });
  it("readiness 0 hard-blocks activation", () => {
    const r = opportunityScore({ demand: 90, fit: 90, intent: 90, timing: 90, readiness: 0 });
    expect(r.vetoed).toBe(true);
  });
  it("confidence uses 35/25/20/20 with corroboration mapping", () => {
    const r = confidenceScore({ quality: 90, independentFamilies: 2, coverage: 70, freshness: 90 });
    expect(r.corroboration).toBe(80);
    expect(r.score).toBe(83.5);
    expect(r.cappedBySingleFamily).toBe(false);
  });
  it("a single source family is capped at 69", () => {
    const r = confidenceScore({ quality: 100, independentFamilies: 1, coverage: 100, freshness: 100 });
    expect(r.corroboration).toBe(0);
    expect(r.score).toBe(69);
    expect(r.cappedBySingleFamily).toBe(true);
  });
  it("corroboration mapping 1→0, 2→80, 3+→100", () => {
    expect(corroborationScore(1)).toBe(0);
    expect(corroborationScore(2)).toBe(80);
    expect(corroborationScore(5)).toBe(100);
  });
});

describe("decision bands (§5 table)", () => {
  it("archives below cutoffs", () => {
    expect(decideBand({ score: 59, confidence: 90, vetoed: false })).toBe("archive");
    expect(decideBand({ score: 90, confidence: 54, vetoed: false })).toBe("archive");
  });
  it("watch/draft in the middle", () => {
    expect(decideBand({ score: 70, confidence: 70, vetoed: false })).toBe("watch_draft");
  });
  it("reviewable brief at ≥75/≥75 no veto", () => {
    expect(decideBand({ score: 86.25, confidence: 83.5, vetoed: false })).toBe("reviewable_brief");
  });
  it("auto-eligible only at ≥85/≥85 with explicit opt-in", () => {
    expect(decideBand({ score: 90, confidence: 90, vetoed: false })).toBe("reviewable_brief");
    expect(decideBand({ score: 90, confidence: 90, vetoed: false, tenantAutoOptIn: true })).toBe("auto_eligible");
    expect(decideBand({ score: 90, confidence: 90, vetoed: true, tenantAutoOptIn: true })).toBe("watch_draft");
  });
});
