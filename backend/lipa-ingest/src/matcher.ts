import type { LedgerSink } from "@nzela/ledger";
import type { ParsedPayment } from "./parsers.js";

/**
 * Payment ↔ order matching — FR-P1/FR-P4. Target: auto-match ≥ 95% within
 * 30 s. Unmatched payments after 3 minutes escalate to the Litige agent,
 * then ops, with the customer proactively informed.
 */

export const MATCH_ESCALATION_MS = 3 * 60_000;

export interface OpenOrder {
  tkRef: string;
  totalFc: number;
  waId: string;
  placedAt: Date;
}

export type MatchResult =
  | { matched: true; order: OpenOrder; exact: boolean }
  | {
      matched: false;
      reason:
        | "no-ref"
        | "unknown-ref"
        | "amount-mismatch"
        | "underpaid"
        | "invalid-amount";
    };

/**
 * Amount tolerance is ASYMMETRIC on purpose. Underpayment is a direct loss
 * to us, so the default forgives NONE of it — a payment short of the due
 * amount is never auto-matched, it escalates to ops (FR-P4). Overpayment is
 * the customer's choice and costs us nothing, so a small band is accepted so
 * a rounded-up transfer still matches. Ops can widen `underpayFc` from
 * config if real operator behaviour ever demands it — it is a money
 * decision, made explicitly, never a silent default.
 */
export interface MatchTolerance {
  /** Max FC a payment may fall SHORT of the due amount and still match. */
  underpayFc: number;
  /** Max FC a payment may EXCEED the due amount and still match. */
  overpayFc: number;
}

export const DEFAULT_TOLERANCE: MatchTolerance = { underpayFc: 0, overpayFc: 100 };

/** Does the paid amount clear the due amount within the asymmetric band? */
function amountOk(dueFc: number, paidFc: number, t: MatchTolerance): boolean {
  const diff = paidFc - dueFc; // <0 = underpaid, >0 = overpaid
  return diff >= -t.underpayFc && diff <= t.overpayFc;
}

export function matchPayment(
  payment: ParsedPayment,
  openOrders: readonly OpenOrder[],
  ledger: LedgerSink,
  tolerance: MatchTolerance = DEFAULT_TOLERANCE,
): MatchResult {
  const log = (purpose: string, tkRef?: string) =>
    ledger.write({
      type: "ai",
      agent: "lipa",
      purpose,
      costUsd: 0.0002,
      tkRef,
      at: new Date(),
    });

  // Defense in depth: the parser already rejects non-finite amounts, but
  // the matcher must never trust its callers — NaN defeats every numeric
  // comparison below and would otherwise slide through the tolerance check.
  if (!Number.isFinite(payment.amountFc) || payment.amountFc <= 0) {
    log("SMS with invalid amount rejected", payment.tkRef);
    return { matched: false, reason: "invalid-amount" };
  }

  if (!payment.tkRef) {
    // No TK ref — try amount fallback: a single open order this payment
    // fully covers (no underpay) is an unambiguous match.
    const byAmount = openOrders.filter((o) =>
      amountOk(o.totalFc, payment.amountFc, tolerance),
    );
    if (byAmount.length === 1) {
      const order = byAmount[0]!;
      log(`SMS matched by unique amount ${payment.amountFc} FC`, order.tkRef);
      return { matched: true, order, exact: false };
    }
    log("SMS without TK ref — escalation candidate");
    return { matched: false, reason: "no-ref" };
  }

  const order = openOrders.find((o) => o.tkRef === payment.tkRef);
  if (!order) {
    log(`SMS ref ${payment.tkRef} not among open orders`);
    return { matched: false, reason: "unknown-ref" };
  }

  if (!amountOk(order.totalFc, payment.amountFc, tolerance)) {
    const underpaid = payment.amountFc < order.totalFc;
    log(
      `SMS ${payment.tkRef}: ${underpaid ? "UNDERPAID" : "amount"} ${payment.amountFc} FC vs due ${order.totalFc} FC`,
      order.tkRef,
    );
    // Underpayment must never silently settle an order — it is a loss.
    return { matched: false, reason: underpaid ? "underpaid" : "amount-mismatch" };
  }

  log(`payment matched to ${order.tkRef}`, order.tkRef);
  return { matched: true, order, exact: true };
}

/** FR-P4: has this unmatched payment aged past the escalation window? */
export function needsEscalation(receivedAt: Date, now: Date): boolean {
  return now.getTime() - receivedAt.getTime() >= MATCH_ESCALATION_MS;
}
