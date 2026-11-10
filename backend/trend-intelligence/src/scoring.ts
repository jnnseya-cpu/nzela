/**
 * Detection & scoring — deterministic, zero-token (spec §5, §17).
 *
 * Every number here is reproducible from inputs. The spec's worked example
 * (§5/§90) must come out as opportunity 86.25 / confidence 83.5 — see
 * conformance test TI-03. Scores are computed at full precision; round only
 * for display.
 */

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Median absolute deviation. */
export function mad(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/** Per-source movement: lift = ln((c+1)/(b+1)). */
export function logLift(current: number, baseline: number): number {
  return Math.log((current + 1) / (baseline + 1));
}

/**
 * Robust anomaly score:
 *   z = (log1p(c) − median(log1p(x))) / max(1.4826·MAD(log1p(x)), 0.2)
 * The 0.2 floor stops tiny spreads from exploding z.
 */
export function robustZ(current: number, history: readonly number[]): number {
  const logs = history.map((x) => Math.log1p(x));
  const denom = Math.max(1.4826 * mad(logs), 0.2);
  return (Math.log1p(current) - median(logs)) / denom;
}

export interface CountGate {
  minCount: number; // default 20
  minZ: number; // default 2
}
export const DEFAULT_COUNT_GATE: CountGate = { minCount: 20, minZ: 2 };

export interface CountGateResult {
  passed: boolean;
  insufficientHistory: boolean; // < 4 comparable periods → draft-only
  z: number;
  lift: number;
  reasons: string[];
}

/**
 * Count-feed gate (§5.3): c ≥ 20 and z ≥ 2 (both adjustable). With fewer than
 * four comparable periods, label insufficient history and keep draft-only.
 * NEVER apply raw-count thresholds to indexed/relative feeds — callers use a
 * source-specific gate for those.
 */
export function countFeedGate(
  current: number,
  baseline: number,
  history: readonly number[],
  gate: CountGate = DEFAULT_COUNT_GATE,
): CountGateResult {
  const z = robustZ(current, history);
  const lift = logLift(current, baseline);
  const insufficientHistory = history.length < 4;
  const reasons: string[] = [];
  if (current < gate.minCount) reasons.push(`count ${current} < ${gate.minCount}`);
  if (z < gate.minZ) reasons.push(`z ${z.toFixed(2)} < ${gate.minZ}`);
  if (insufficientHistory) reasons.push("insufficient history (<4 comparable periods)");
  const passed = current >= gate.minCount && z >= gate.minZ && !insufficientHistory;
  return { passed, insufficientHistory, z, lift, reasons };
}

/** Reference demand mapping for count feeds (§17): clamp(50 + 10·z, 0, 100). */
export function demandFromZ(z: number): number {
  return clamp(50 + 10 * z, 0, 100);
}

// --- Opportunity score (§5.4): 25/25/20/15/15 ---
export interface OpportunityInputs {
  demand: number; // 0–100
  fit: number;
  intent: number;
  timing: number;
  readiness: number;
}
export interface Veto {
  kind: "out_of_market" | "unsupported_claim" | "restricted_topic" | "unavailable_inventory" | "illegal_targeting";
  detail?: string;
}
export interface OpportunityResult {
  score: number;
  vetoed: boolean;
  vetoes: Veto[];
  breakdown: Record<keyof OpportunityInputs, number>;
}

export function opportunityScore(inp: OpportunityInputs, vetoes: Veto[] = []): OpportunityResult {
  // Missing readiness blocks activation (readiness 0 is a hard block).
  const score =
    0.25 * inp.demand + 0.25 * inp.fit + 0.2 * inp.intent + 0.15 * inp.timing + 0.15 * inp.readiness;
  return {
    score,
    vetoed: vetoes.length > 0 || inp.readiness <= 0,
    vetoes,
    breakdown: { ...inp },
  };
}

// --- Confidence (§5.5 / §17): 35/25/20/20, single-family cap 69 ---
export interface ConfidenceInputs {
  quality: number; // 0–100 (mean of contributing families' configured quality)
  independentFamilies: number; // distinct corroborating source families
  coverage: number; // 0–100
  freshness: number; // 0–100
}
export interface ConfidenceResult {
  score: number;
  corroboration: number;
  cappedBySingleFamily: boolean;
}

/** Corroboration mapping (§17): 1 family → 0, 2 → 80, ≥3 → 100. */
export function corroborationScore(independentFamilies: number): number {
  if (independentFamilies >= 3) return 100;
  if (independentFamilies === 2) return 80;
  return 0;
}

export function confidenceScore(inp: ConfidenceInputs): ConfidenceResult {
  const corroboration = corroborationScore(inp.independentFamilies);
  const raw = 0.35 * inp.quality + 0.25 * corroboration + 0.2 * inp.coverage + 0.2 * inp.freshness;
  // "cap a single source family at 69" — one family cannot exceed 69 confidence.
  const cappedBySingleFamily = inp.independentFamilies < 2 && raw > 69;
  const score = cappedBySingleFamily ? 69 : raw;
  return { score, corroboration, cappedBySingleFamily };
}

// --- Decision bands (§5 table) ---
export type Decision = "archive" | "watch_draft" | "reviewable_brief" | "auto_eligible";

export interface DecisionInput {
  score: number;
  confidence: number;
  vetoed: boolean;
  tenantAutoOptIn?: boolean; // required for auto_eligible
}

export function decideBand(d: DecisionInput): Decision {
  if (d.score < 60 || d.confidence < 55) return "archive";
  if (
    d.score >= 85 && d.confidence >= 85 && !d.vetoed && d.tenantAutoOptIn === true
  ) {
    return "auto_eligible";
  }
  if (d.score >= 75 && d.confidence >= 75 && !d.vetoed) return "reviewable_brief";
  return "watch_draft";
}
