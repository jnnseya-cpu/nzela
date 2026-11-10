import type { LedgerSink } from "@nzela/ledger";
import {
  opportunityScore, confidenceScore, decideBand, countFeedGate, demandFromZ,
  type Veto, type Decision, type CountGate, DEFAULT_COUNT_GATE,
} from "./scoring.js";
import { independentFamilyCount } from "./corroboration.js";
import { validateGrowthBrief, type GrowthBrief, type Channel } from "./brief.js";
import type { PlatformProfile } from "./nzela-profile.js";
import { type NzelaSignal, demandCount, toObservation } from "./signals.js";

/**
 * Trend coordinator — embeds the trend-intelligence control loop into NZELA.
 * It ingests NZELA first-party signals, scores a topic deterministically with
 * the core, and (only when the decision warrants it) emits a validated Growth
 * Brief that the existing SEO and growth agents resolve at run time. No model
 * is required here; all math is reproducible. Audit goes to the shared ledger.
 */

/** Per-source-family quality (0–100) for confidence (§17 source quality). */
const FAMILY_QUALITY: Record<string, number> = {
  first_party_conversions: 90,
  first_party_orders: 80,
  first_party_search: 70,
  first_party_referrals: 70,
  owned_page_attention: 50,
};

export interface AssessContext {
  nowMs: number;
  baselineCount: number;
  history: number[];
  freshnessMs: number;
  /** 0–100 remaining actionable window. */
  timing: number;
  /** 0–100 stock/capacity/approved-assets readiness; 0 vetoes activation. */
  readiness: number;
  coverage?: number; // 0–100; default 80
  countGate?: CountGate;
  tenantAutoOptIn?: boolean;
  extraVetoes?: Veto[];
}

export interface Assessment {
  topic: string;
  decision: Decision;
  opportunityScore: number;
  confidence: number;
  demand: number;
  independentFamilies: number;
  z: number;
  gatePassed: boolean;
  vetoed: boolean;
  reasons: string[];
}

export class TrendCoordinator {
  private readonly buffers = new Map<string, NzelaSignal[]>();

  constructor(
    private readonly profile: PlatformProfile,
    private readonly ledger?: LedgerSink,
  ) {}

  /** Ingest one first-party signal (call from the live order/payment paths). */
  record(signal: NzelaSignal): void {
    const arr = this.buffers.get(signal.topic) ?? [];
    arr.push(signal);
    this.buffers.set(signal.topic, arr);
  }

  signalsFor(topic: string): readonly NzelaSignal[] {
    return this.buffers.get(topic) ?? [];
  }

  /** Deterministic score for a topic from accumulated signals + context. */
  assess(topic: string, ctx: AssessContext): Assessment {
    const signals = this.signalsFor(topic);
    const c = demandCount(signals, topic);
    const gate = countFeedGate(c, ctx.baselineCount, ctx.history, ctx.countGate ?? DEFAULT_COUNT_GATE);

    const observations = signals.map((s) =>
      toObservation(s, { freshnessMs: ctx.freshnessMs, nowMs: ctx.nowMs, topic, market: this.profile.default_market }),
    );
    const independentFamilies = independentFamilyCount(observations);

    const demand = demandFromZ(gate.z);
    const fit = this.profile.topic_fit[topic] ?? 0;
    const intent = this.profile.topic_intent[topic] ?? 0;

    const vetoes: Veto[] = [...(ctx.extraVetoes ?? [])];
    if (this.profile.forbidden_topics.includes(topic)) vetoes.push({ kind: "restricted_topic", detail: topic });

    const opp = opportunityScore({ demand, fit, intent, timing: ctx.timing, readiness: ctx.readiness }, vetoes);

    // confidence inputs from the real observation mix
    const families = [...new Set(observations.filter((o) => o.fresh && o.relevant && !o.contextOnly).map((o) => o.sourceFamily))];
    const quality = families.length
      ? families.reduce((s, f) => s + (FAMILY_QUALITY[f] ?? 50), 0) / families.length
      : 0;
    const relevantObs = observations.filter((o) => o.relevant);
    const freshness = relevantObs.length
      ? (relevantObs.filter((o) => o.fresh).length / relevantObs.length) * 100
      : 0;
    const conf = confidenceScore({
      quality, independentFamilies, coverage: ctx.coverage ?? 80, freshness,
    });

    const decision = decideBand({
      score: opp.score, confidence: conf.score, vetoed: opp.vetoed, tenantAutoOptIn: ctx.tenantAutoOptIn,
    });

    const reasons = [...gate.reasons];
    if (opp.vetoed) reasons.push("vetoed");
    if (conf.cappedBySingleFamily) reasons.push("single-source-family cap");

    this.ledger?.write({
      type: "deterministic",
      agent: "growth",
      purpose: `trend assess ${topic}: score ${opp.score.toFixed(1)} conf ${conf.score.toFixed(1)} → ${decision}`,
      costUsd: 0,
      at: new Date(ctx.nowMs),
    });

    return {
      topic, decision, opportunityScore: opp.score, confidence: conf.score,
      demand, independentFamilies, z: gate.z, gatePassed: gate.passed,
      vetoed: opp.vetoed, reasons,
    };
  }

  /**
   * Build a validated Growth Brief for a topic when the decision warrants a
   * reviewable brief. Returns the brief, or the assessment + reason when not.
   * IDs/claims come from the profile — the agent gets claim TEXT via scoped
   * lookup, never free text.
   */
  buildBrief(
    topic: string,
    params: {
      ctx: AssessContext;
      briefId: string;
      briefVersion: number;
      tenantId: string;
      evidenceIds: string[];
      policyVersion: number;
      experimentId: string;
      validityMs?: number; // default 7 days (persistent); breaking topics pass 24h
      channels?: Channel[];
    },
  ): { brief: GrowthBrief; assessment: Assessment } | { brief: null; assessment: Assessment } {
    const assessment = this.assess(topic, params.ctx);
    if (assessment.decision !== "reviewable_brief" && assessment.decision !== "auto_eligible") {
      return { brief: null, assessment };
    }
    const now = params.ctx.nowMs;
    const validity = params.validityMs ?? 7 * 24 * 60 * 60 * 1000;
    const candidate: GrowthBrief = {
      schema_version: 1,
      brief_id: params.briefId,
      brief_version: params.briefVersion,
      tenant_id: params.tenantId,
      platform_id: this.profile.platform_id,
      market: this.profile.default_market,
      locale: this.profile.default_locale,
      topic_id: topic,
      opportunity_score: assessment.opportunityScore,
      confidence: assessment.confidence,
      valid_from: new Date(now).toISOString(),
      expires_at: new Date(now + validity).toISOString(),
      evidence_ids: params.evidenceIds,
      audience: this.audienceFor(topic),
      intent: this.intentFor(topic),
      approved_claim_ids: this.claimsFor(topic),
      cta_id: this.profile.allowed_cta_ids[0] ?? "cta_commander_whatsapp",
      allowed_channels: params.channels ?? this.profile.allowed_channels,
      prohibited_claims: this.profile.prohibited_claims.slice(0, 32),
      objective: `${this.profile.outcome.conversion} per ${this.profile.outcome.denominator}`,
      experiment_id: params.experimentId,
      policy_version: params.policyVersion,
    };
    const v = validateGrowthBrief(candidate);
    if (!v.ok) {
      // A profile/data bug must surface, never ship an invalid brief.
      throw new Error(`built an invalid Growth Brief for ${topic}: ${v.errors.join("; ")}`);
    }
    return { brief: v.value, assessment };
  }

  // --- profile-derived brief text (brand-neutral core never does this) ---
  private audienceFor(topic: string): string {
    return `Clients à ${this.profile.default_market} intéressés par « ${topic.replace(/-/g, " ")} »`;
  }
  private intentFor(topic: string): string {
    return `commander (${topic.replace(/-/g, " ")})`;
  }
  /** Map a topic to the subset of approved claims that fit it. */
  private claimsFor(topic: string): string[] {
    const all = Object.keys(this.profile.approved_claims);
    const pick = (ids: string[]) => ids.filter((id) => all.includes(id));
    if (topic.includes("mobile-money")) return pick(["claim_mobile_money", "claim_cash_remise", "claim_rembourse_40s"]);
    if (topic.includes("code-retrait") || topic.includes("securite")) return pick(["claim_code_retrait", "claim_cash_remise"]);
    if (topic.includes("plat-chaud") || topic.includes("bandal")) return pick(["claim_5km_chaud", "claim_cash_remise"]);
    if (topic.includes("parrainage")) return pick(["claim_rembourse_40s", "claim_cash_remise"]);
    if (topic.includes("resto") || topic.includes("partenaire")) return pick(["claim_0_commission", "claim_wewa_70"]);
    return pick(["claim_cash_remise", "claim_5km_chaud", "claim_mobile_money"]);
  }
}
