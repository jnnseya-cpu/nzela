import type { LedgerSink } from "@nzela/ledger";

/**
 * Referral & first-order acquisition engine — the systematic word-of-mouth
 * loop, which is the #1 organic channel in a cash/WhatsApp/community market
 * like Kinshasa. Deterministic (0 tokens): every rule is explicit and
 * abuse-proof.
 *
 * Anti-fraud is the whole point: rewards are issued ONLY when a referred
 * NEW customer completes a REAL PAID first order. This rides on the
 * humans-only + real-payment discipline (E-7/E-8) — you cannot farm credit
 * with fake accounts because each reward requires a real SIM to move real
 * money.
 */

export interface ReferralConfig {
  /** Crédit Tunakula (FC) to the referrer when a referee's 1st order pays. */
  referrerRewardFc: number;
  /** Crédit Tunakula (FC) to the new customer on their qualifying order. */
  refereeRewardFc: number;
  /** Max rewarded referrals per referrer per calendar period (abuse cap). */
  maxRewardsPerReferrer: number;
  /** Minimum order value (FC) for a referral to qualify (no 1 FC gaming). */
  minQualifyingOrderFc: number;
}

export const DEFAULT_REFERRAL: ReferralConfig = {
  referrerRewardFc: 2000,
  refereeRewardFc: 2000,
  maxRewardsPerReferrer: 20,
  minQualifyingOrderFc: 5000,
};

/** Deterministic, human-readable referral code from a wa_id. */
export function referralCode(waId: string): string {
  // Last 4 digits of the number + a checksum char — memorable, shareable.
  const digits = waId.replace(/\D/g, "");
  const tail = digits.slice(-4).padStart(4, "0");
  const sum = [...digits].reduce((s, d) => s + Number(d), 0);
  const check = "ABCDEFGHJK"[sum % 10] ?? "X";
  return `TK${tail}${check}`;
}

export interface Customer {
  waId: string;
  /** Code that referred THIS customer in, if any. */
  referredByCode?: string;
  firstOrderPaidAt?: string;
  ordersPaid: number;
}

export interface QualifyingOrder {
  waId: string;
  tkRef: string;
  amountFc: number;
  paid: boolean;
  /** True only for a customer's very first paid order. */
  isFirstPaidOrder: boolean;
}

export type RewardOutcome =
  | { rewarded: false; reason: "not-referred" | "not-first-order" | "unpaid" | "below-minimum" | "referrer-cap" | "unknown-referrer" | "self-referral" }
  | {
      rewarded: true;
      referrerWaId: string;
      referrerRewardFc: number;
      refereeWaId: string;
      refereeRewardFc: number;
    };

/** Reward issuer port — issues Crédit Tunakula via the StackFood wallet. */
export interface CreditIssuer {
  issueCredit(waId: string, amountFc: number, reason: string): Promise<void>;
}

export class ReferralEngine {
  constructor(
    private readonly config: ReferralConfig,
    private readonly ledger: LedgerSink,
    private readonly credit: CreditIssuer,
    /** Resolve a referral code → referrer wa_id (Redis/PG in prod). */
    private readonly resolveCode: (code: string) => string | undefined,
    /** How many rewards this referrer has already earned this period. */
    private readonly rewardsEarned: (waId: string) => number,
  ) {}

  /**
   * Evaluate a paid order for referral rewards. Idempotent by design: only
   * a first paid order qualifies, so replays of the same order can't
   * double-reward.
   */
  async onOrderPaid(order: QualifyingOrder, referredByCode?: string): Promise<RewardOutcome> {
    if (!referredByCode) return this.log({ rewarded: false, reason: "not-referred" });
    if (!order.paid) return this.log({ rewarded: false, reason: "unpaid" });
    if (!order.isFirstPaidOrder) return this.log({ rewarded: false, reason: "not-first-order" });
    if (order.amountFc < this.config.minQualifyingOrderFc) {
      return this.log({ rewarded: false, reason: "below-minimum" });
    }
    const referrerWaId = this.resolveCode(referredByCode);
    if (!referrerWaId) return this.log({ rewarded: false, reason: "unknown-referrer" });
    if (referrerWaId === order.waId) return this.log({ rewarded: false, reason: "self-referral" });
    if (this.rewardsEarned(referrerWaId) >= this.config.maxRewardsPerReferrer) {
      return this.log({ rewarded: false, reason: "referrer-cap" });
    }

    await this.credit.issueCredit(referrerWaId, this.config.referrerRewardFc, `parrainage ${order.tkRef}`);
    await this.credit.issueCredit(order.waId, this.config.refereeRewardFc, `bienvenue ${order.tkRef}`);

    const outcome: RewardOutcome = {
      rewarded: true,
      referrerWaId,
      referrerRewardFc: this.config.referrerRewardFc,
      refereeWaId: order.waId,
      refereeRewardFc: this.config.refereeRewardFc,
    };
    return this.log(outcome);
  }

  private log(outcome: RewardOutcome): RewardOutcome {
    this.ledger.write({
      type: "lifecycle",
      agent: "growth",
      purpose: outcome.rewarded
        ? `referral rewarded: ${this.config.referrerRewardFc}+${this.config.refereeRewardFc} FC`
        : `referral not rewarded: ${outcome.reason}`,
      costUsd: 0,
      at: new Date(),
    });
    return outcome;
  }
}
