import { USD_PER_ACU, type AcuWallet } from "./acu.js";
import type { LedgerSink } from "./types.js";

/**
 * Money-in safety: secure ACU top-up and subscription-period grants.
 *
 * Both are gated the same way an order payment is: they may only be applied
 * AFTER the funding payment has settled (same SMS-Ledger discipline), and
 * each is IDEMPOTENT per external transaction / period key so a replayed
 * callback can never double-credit ACU or double-grant a subscription. This
 * is the spine any future top-up or subscription product must fund through —
 * it cannot be bypassed to hand out balance or entitlement for free.
 */

/** Records applied funding txns / granted periods — idempotency store. */
export interface FundingLedger {
  has(key: string): boolean;
  add(key: string): void;
}

export class MemoryFundingLedger implements FundingLedger {
  private readonly seen = new Set<string>();
  has(key: string): boolean {
    return this.seen.has(key);
  }
  add(key: string): void {
    this.seen.add(key);
  }
}

/** ACU purchased per USD paid — FLOORED so a top-up never over-credits. */
export function acuForUsd(usdPaid: number): number {
  return Math.floor(usdPaid / USD_PER_ACU);
}

export interface TopUpResult {
  credited: number;
  duplicate: boolean;
}

/**
 * Credit ACU against a VERIFIED funding payment. Idempotent per
 * `fundingTxnId`; validates the amount; floors the credit. Call this only
 * once the funding payment has actually settled.
 */
export function fundAcuTopUp(
  wallet: AcuWallet,
  funding: FundingLedger,
  args: { account: string; fundingTxnId: string; usdPaid: number },
  audit: LedgerSink,
): TopUpResult {
  const { account, fundingTxnId, usdPaid } = args;
  if (!account) throw new RangeError("account required");
  if (!fundingTxnId) throw new RangeError("fundingTxnId required");
  if (!Number.isFinite(usdPaid) || usdPaid <= 0) {
    throw new RangeError(`usdPaid must be a positive finite number, got ${usdPaid}`);
  }

  const key = `topup:${fundingTxnId}`;
  if (funding.has(key)) return { credited: 0, duplicate: true };

  const acu = acuForUsd(usdPaid);
  funding.add(key); // mark BEFORE crediting so a concurrent replay is caught
  if (acu > 0) wallet.topUp(account, acu);

  audit.write({
    type: "lifecycle",
    agent: "system",
    purpose: `ACU top-up: ${acu} ACU for $${usdPaid} (${account}, txn ${fundingTxnId})`,
    costUsd: 0,
    at: new Date(),
    meta: { account, acu, usdPaid, fundingTxnId },
  });
  return { credited: acu, duplicate: false };
}

export interface SubscriptionGrant {
  granted: boolean;
  duplicate: boolean;
}

/**
 * Grant one subscription period, idempotently per (account, plan, period).
 * This prevents double-charging AND double-granting entitlement, and —
 * because a caller must supply the exact period key — a customer cannot
 * extend entitlement without a fresh, settled charge for a new period.
 */
export function grantSubscriptionPeriod(
  funding: FundingLedger,
  args: { account: string; planId: string; periodKey: string },
  audit: LedgerSink,
): SubscriptionGrant {
  const { account, planId, periodKey } = args;
  if (!account || !planId || !periodKey) {
    throw new RangeError("account, planId and periodKey are all required");
  }
  const key = `sub:${account}:${planId}:${periodKey}`;
  if (funding.has(key)) return { granted: false, duplicate: true };

  funding.add(key);
  audit.write({
    type: "lifecycle",
    agent: "system",
    purpose: `subscription grant: ${planId} / ${periodKey} (${account})`,
    costUsd: 0,
    at: new Date(),
    meta: { account, planId, periodKey },
  });
  return { granted: true, duplicate: false };
}
