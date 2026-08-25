import type { AgentId, LedgerSink } from "./types.js";

/**
 * ACU (AI Compute Unit) metering & gating — portfolio billing convention.
 *
 * Hard rule: NO AI action runs for free, ever. Before any LLM/STT/TTS
 * invocation, the middleware must RESERVE the call's maximum ACU cost
 * against an available balance; if the balance can't cover it, the call is
 * REFUSED (gated) and degrades to the deterministic fallback. Real ACUs are
 * debited after the call from actual spend. Deterministic steps cost 0 ACU
 * and never touch the wallet — only metered AI does.
 *
 * The 3× multiplier law applies to resale contexts (partner-facing tools
 * billed to a third party); internal order-path agents run at 1×.
 */

/** USD per ACU — one ACU is the atomic billable unit. Config, not law. */
export const USD_PER_ACU = 0.001; // 1 ACU = $0.001 → $0.05 call = 50 ACU

/** Resale multiplier: partner/third-party billed AI costs 3× internal. */
export const RESALE_MULTIPLIER = 3;

/** Agents whose spend is resold to a partner (3×). Others are 1×. */
const RESALE_AGENTS: ReadonlySet<AgentId> = new Set(["seo", "growth"]);

export function acuMultiplier(agent: AgentId): number {
  return RESALE_AGENTS.has(agent) ? RESALE_MULTIPLIER : 1;
}

/** USD → ACU at the agent's applicable multiplier, rounded up (never
 *  under-bill a fractional unit). */
export function usdToAcu(usd: number, agent: AgentId): number {
  return Math.ceil((usd / USD_PER_ACU) * acuMultiplier(agent));
}

export interface AcuReservation {
  ok: boolean;
  /** ACUs put on hold for this call (0 when refused). */
  reserved: number;
  balanceAfter: number;
}

/**
 * Pluggable balance store. In production this is a Postgres/Redis-backed
 * per-account wallet with atomic reserve/commit; here an in-memory impl
 * gives the same contract for tests and the deterministic core.
 */
export interface AcuWallet {
  /** Reserve up to `maxAcu`; returns ok=false if balance can't cover it. */
  reserve(account: string, maxAcu: number): AcuReservation;
  /** Commit actual usage ≤ reserved; releases the unused hold. */
  commit(account: string, reserved: number, actualAcu: number): void;
  /** Release the whole hold (call failed, nothing consumed). */
  release(account: string, reserved: number): void;
  balance(account: string): number;
}

export class InsufficientAcuError extends Error {
  constructor(
    readonly account: string,
    readonly needed: number,
    readonly available: number,
  ) {
    super(`Insufficient ACU for ${account}: need ${needed}, have ${available}`);
  }
}

export class InMemoryAcuWallet implements AcuWallet {
  private readonly balances = new Map<string, number>();
  /** Held (reserved-not-committed) ACUs per account. */
  private readonly held = new Map<string, number>();

  constructor(initial: Record<string, number> = {}) {
    for (const [acct, bal] of Object.entries(initial)) {
      this.balances.set(acct, bal);
    }
  }

  /**
   * Credit ACUs to an account. Top-ups are money-backed, so the amount must
   * be a positive, finite integer — a NaN/negative/fractional value would
   * corrupt the balance (and NaN silently defeats every later comparison),
   * so it is rejected loudly rather than written.
   */
  topUp(account: string, acu: number): void {
    if (!Number.isInteger(acu) || acu <= 0) {
      throw new RangeError(`topUp requires a positive integer ACU, got ${acu}`);
    }
    this.balances.set(account, (this.balances.get(account) ?? 0) + acu);
  }

  balance(account: string): number {
    return (this.balances.get(account) ?? 0) - (this.held.get(account) ?? 0);
  }

  reserve(account: string, maxAcu: number): AcuReservation {
    const available = this.balance(account);
    // A non-finite or non-positive request is refused: NaN must never pass
    // the balance check (NaN comparisons are always false) and mint a hold.
    if (!Number.isFinite(maxAcu) || maxAcu <= 0 || available < maxAcu) {
      return { ok: false, reserved: 0, balanceAfter: available };
    }
    this.held.set(account, (this.held.get(account) ?? 0) + maxAcu);
    return { ok: true, reserved: maxAcu, balanceAfter: this.balance(account) };
  }

  commit(account: string, reserved: number, actualAcu: number): void {
    const spend = Math.min(Math.max(actualAcu, 0), Math.max(reserved, 0));
    // Clamp at 0: a stray double-commit/release must never drive `held`
    // negative (which would inflate available balance = free ACU) or push a
    // balance below zero.
    this.held.set(account, Math.max(0, (this.held.get(account) ?? 0) - reserved));
    this.balances.set(account, Math.max(0, (this.balances.get(account) ?? 0) - spend));
  }

  release(account: string, reserved: number): void {
    this.held.set(account, Math.max(0, (this.held.get(account) ?? 0) - reserved));
  }
}

/** Ledger an ACU debit alongside the AI event (audit + reporting). */
export function ledgerAcuDebit(
  ledger: LedgerSink,
  agent: AgentId,
  account: string,
  acu: number,
  purpose: string,
  tkRef?: string,
): void {
  ledger.write({
    type: "ai",
    agent,
    purpose: `${purpose} · ${acu} ACU debited (${account})`,
    costUsd: acu * USD_PER_ACU,
    tkRef,
    at: new Date(),
    meta: { acu, account },
  });
}
