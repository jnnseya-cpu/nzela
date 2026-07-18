import { AGENT_REGISTRY } from "./registry.js";
import type { AgentId, LedgerSink } from "./types.js";

/**
 * Budget middleware — FR-A1. Every non-deterministic agent runs behind this:
 * it meters real spend, writes a ledger event per invocation, and hard-stops
 * at the cap with a deterministic fallback. Budget exhaustion degrades to
 * buttons, never to failure.
 */

export interface AgentCallContext {
  tkRef?: string;
  purpose: string;
}

export interface AgentCallResult<T> {
  value: T;
  /** Real metered spend reported by the invocation (USD). */
  costUsd: number;
}

export type AgentInvocation<T> = (
  /** Remaining budget for this call; the invocation must respect it. */
  budgetUsd: number,
) => Promise<AgentCallResult<T>>;

export class BudgetExceededError extends Error {
  constructor(
    readonly agent: AgentId,
    readonly costUsd: number,
    readonly budgetUsd: number,
  ) {
    super(
      `Agent ${agent} spent $${costUsd} against a hard cap of $${budgetUsd}`,
    );
  }
}

export class BudgetMiddleware {
  /** Per-order cumulative spend, keyed `${agent}:${tkRef}`. */
  private readonly perOrderSpend = new Map<string, number>();

  constructor(private readonly ledger: LedgerSink) {}

  spentOnOrder(agent: AgentId, tkRef: string): number {
    return this.perOrderSpend.get(`${agent}:${tkRef}`) ?? 0;
  }

  /**
   * Run `invoke` under the agent's hard cap. If the cap is already exhausted
   * for this order, or the invocation reports overspend, `fallback` is used
   * and a ledger event records the degradation.
   */
  async run<T>(
    agent: AgentId,
    ctx: AgentCallContext,
    invoke: AgentInvocation<T>,
    fallback: () => T,
  ): Promise<T> {
    const spec = AGENT_REGISTRY[agent];
    const orderKey = ctx.tkRef ? `${agent}:${ctx.tkRef}` : undefined;

    let remaining = spec.budgetPerCallUsd;
    if (orderKey && spec.budgetPerOrderUsd !== undefined) {
      remaining = Math.min(
        remaining,
        spec.budgetPerOrderUsd - (this.perOrderSpend.get(orderKey) ?? 0),
      );
    }

    if (remaining <= 0) {
      this.ledger.write({
        type: "budget-exhausted",
        agent,
        purpose: ctx.purpose,
        costUsd: 0,
        tkRef: ctx.tkRef,
        at: new Date(),
      });
      return fallback();
    }

    let result: AgentCallResult<T>;
    try {
      result = await invoke(remaining);
    } catch {
      // Provider failure degrades to the deterministic path, never to the
      // customer seeing an error.
      this.ledger.write({
        type: "budget-exhausted",
        agent,
        purpose: `${ctx.purpose} (invocation failed)`,
        costUsd: 0,
        tkRef: ctx.tkRef,
        at: new Date(),
      });
      return fallback();
    }

    const cost = result.costUsd;
    if (orderKey) {
      this.perOrderSpend.set(
        orderKey,
        (this.perOrderSpend.get(orderKey) ?? 0) + cost,
      );
    }
    this.ledger.write({
      type: "ai",
      agent,
      purpose: ctx.purpose,
      costUsd: cost,
      tkRef: ctx.tkRef,
      at: new Date(),
    });

    if (cost > remaining) {
      // Overspend is a bug in the invocation's own metering; the result is
      // discarded and the deterministic fallback served (hard-stop, FR-A1).
      this.ledger.write({
        type: "budget-exhausted",
        agent,
        purpose: `${ctx.purpose} (overspend $${cost.toFixed(4)})`,
        costUsd: 0,
        tkRef: ctx.tkRef,
        at: new Date(),
      });
      return fallback();
    }

    return result.value;
  }
}
