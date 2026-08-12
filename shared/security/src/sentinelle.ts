import {
  BudgetMiddleware,
  type AcuGating,
  type LedgerSink,
} from "@nzela/ledger";
import { assessHumanity, type HumanityResult, type HumanitySignals } from "./humanity.js";
import {
  INSTRUCTION_BLOCK_REPLY,
  screenInstruction,
  type FirewallResult,
} from "./instruction-firewall.js";
import { detectThreat, type ThreatSignal, type ThreatVerdict } from "./threat.js";

/**
 * Sentinelle — the anti-hacking agent (#11). Deterministic-first: the
 * humanity gate, instruction firewall and WAF signatures run at 0 tokens
 * and decide the vast majority of cases outright. The LLM is invoked ONLY
 * to triage a payload the rules flag as suspicious-but-unclassified, and
 * that call is budget-capped AND ACU-gated (E-7) like every other agent.
 * Every decision is written to the ledger as a security event.
 */

export type SecurityAction = "allow" | "challenge" | "block";

export interface SecurityDecision {
  action: SecurityAction;
  reason: string;
  /** Customer-safe reply when a message is blocked (never echoes payload). */
  reply?: string;
}

/** LLM triage port — real model in prod, injectable in tests. */
export interface ThreatTriage {
  classify(
    payload: string,
    budgetUsd: number,
  ): Promise<{ malicious: boolean; label: string; costUsd: number }>;
}

export class Sentinelle {
  private readonly budget: BudgetMiddleware;

  constructor(
    private readonly ledger: LedgerSink,
    private readonly triage?: ThreatTriage,
    acu?: AcuGating,
  ) {
    this.budget = new BudgetMiddleware(ledger, acu);
  }

  /** Gate an auth/section-entry attempt: only humans pass. */
  gateHumanity(signals: HumanitySignals, surface: string): SecurityDecision {
    const r: HumanityResult = assessHumanity(signals);
    this.log(
      r.verdict === "allow" ? "deterministic" : "block",
      `humanity ${surface}: ${r.verdict} (score ${r.score}; ${r.reasons.join(", ")})`,
    );
    return {
      action: r.verdict,
      reason: r.reasons.join(", ") || `score ${r.score}`,
      reply:
        r.verdict === "block"
          ? "Accès réservé aux humains. Si tu es une vraie personne, réessaie ou contacte-nous sur WhatsApp."
          : undefined,
    };
  }

  /** Screen an inbound message for non-human instructions. */
  screenMessage(text: string): SecurityDecision {
    const r: FirewallResult = screenInstruction(text);
    if (r.verdict === "blocked") {
      this.log("block", `instruction firewall: ${r.category} (${r.matched})`);
      return { action: "block", reason: r.category!, reply: INSTRUCTION_BLOCK_REPLY };
    }
    return { action: "allow", reason: "human-ok" };
  }

  /**
   * Inspect a request surface for attacks. Confident rule hits block
   * immediately (0 tokens). A suspicious-but-unclassified payload is
   * escalated to the LLM triage under budget + ACU gate, with a safe
   * default: if triage can't run (no ACU / provider down), the request is
   * CHALLENGED, never silently allowed.
   */
  async inspect(signal: ThreatSignal, account?: string): Promise<SecurityDecision> {
    const v: ThreatVerdict = detectThreat(signal);
    if (v.threat !== "clean") {
      this.log("block", `threat ${v.threat}/${v.severity}: ${v.detail}`);
      return { action: "block", reason: `${v.threat} (${v.severity})` };
    }

    // Rules say clean but heuristics smell odd → AI triage (escalation).
    if (this.triage && looksSuspicious(signal.payload)) {
      const decision = await this.budget.run(
        "sentinelle",
        { purpose: "threat triage (ambiguous payload)", account },
        async (budgetUsd) => {
          const t = await this.triage!.classify(signal.payload, budgetUsd);
          return { value: t, costUsd: t.costUsd };
        },
        // Fallback when the LLM can't run: fail SAFE, not open.
        () => ({ malicious: true, label: "unverifiable → challenged", costUsd: 0 }),
      );
      if (decision.malicious) {
        this.log("block", `AI triage: ${decision.label}`);
        return { action: "challenge", reason: decision.label };
      }
    }
    return { action: "allow", reason: "clean" };
  }

  private log(
    type: "deterministic" | "block" | "ai",
    purpose: string,
  ): void {
    this.ledger.write({
      type,
      agent: "sentinelle",
      purpose,
      costUsd: 0,
      at: new Date(),
    });
  }
}

/** Cheap heuristic: does the payload contain characters/words that warrant
 *  a closer (LLM) look even though no signature fired? */
function looksSuspicious(payload: string): boolean {
  const oddChars = (payload.match(/[<>{}$`;|]/g) ?? []).length;
  return oddChars >= 3 || /\b(select|insert|update|delete|eval|base64)\b/i.test(payload);
}
