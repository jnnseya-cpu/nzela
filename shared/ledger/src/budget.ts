import { AGENT_REGISTRY } from "./registry.js";
import { ledgerAcuDebit, usdToAcu, type AcuWallet } from "./acu.js";
import type { AgentId, LedgerSink } from "./types.js";

/**
 * Budget middleware — FR-A1. Every non-deterministic agent runs behind this:
 * it meters real spend, writes a ledger event per invocation, and hard-stops
 * at the cap with a deterministic fallback. Budget exhaustion degrades to
 * buttons, never to failure.
 *
 * ACU gating: when constructed with an AcuWallet, EVERY AI invocation is
 * pre-authorized against the account's ACU balance — the call's maximum
 * cost is reserved before it runs, and if the balance can't cover it the
 * call is REFUSED and degrades to the fallback. No AI action runs for free.
 */

export interface AgentCallContext {
  tkRef?: string;
  purpose: string;
  /** ACU account to bill this call to. Required when a wallet is set. */
  account?: string;
}

export interface AcuGating {
  wallet: AcuWallet;
  /** Account used when a call omits ctx.account (e.g. the platform's own). */
  defaultAccount: string;
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

  constructor(
    private readonly ledger: LedgerSink,
    /** Optional ACU gating. When set, no AI call runs without ACU cover. */
    private readonly acu?: AcuGating,
  ) {}

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

    // ACU GATE — no AI action runs without pre-authorized ACU cover.
    let account: string | undefined;
    let reserved = 0;
    if (this.acu) {
      account = ctx.account ?? this.acu.defaultAccount;
      const maxAcu = usdToAcu(remaining, agent);
      const res = this.acu.wallet.reserve(account, maxAcu);
      if (!res.ok) {
        this.ledger.write({
          type: "acu-gated",
          agent,
          purpose: `${ctx.purpose} (refused: need ${maxAcu} ACU, have ${res.balanceAfter} — account ${account})`,
          costUsd: 0,
          tkRef: ctx.tkRef,
          at: new Date(),
          meta: { account, neededAcu: maxAcu, availableAcu: res.balanceAfter },
        });
        return fallback();
      }
      reserved = res.reserved;
    }

    let result: AgentCallResult<T>;
    try {
      result = await invoke(remaining);
    } catch {
      // Provider failure: release the ACU hold (nothing consumed) and
      // degrade to the deterministic path, never a customer-visible error.
      if (this.acu && account) this.acu.wallet.release(account, reserved);
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

    if (cost > remaining) {
      // Overspend is a bug in the invocation's own metering; discard the
      // result, release the ACU hold, serve the fallback (hard-stop, FR-A1).
      if (this.acu && account) this.acu.wallet.release(account, reserved);
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

    // Success — meter USD, and debit real ACUs from the reserved hold.
    if (orderKey) {
      this.perOrderSpend.set(
        orderKey,
        (this.perOrderSpend.get(orderKey) ?? 0) + cost,
      );
    }
    if (this.acu && account) {
      const actualAcu = usdToAcu(cost, agent);
      this.acu.wallet.commit(account, reserved, actualAcu);
      ledgerAcuDebit(this.ledger, agent, account, actualAcu, ctx.purpose, ctx.tkRef);
    } else {
      this.ledger.write({
        type: "ai",
        agent,
        purpose: ctx.purpose,
        costUsd: cost,
        tkRef: ctx.tkRef,
        at: new Date(),
      });
    }

    return result.value;
  }
}
