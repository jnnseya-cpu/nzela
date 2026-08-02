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
      reason: "no-ref" | "unknown-ref" | "amount-mismatch" | "invalid-amount";
    };

/** Small tolerance for operator rounding on the FC amount. */
const AMOUNT_TOLERANCE_FC = 100;

export function matchPayment(
  payment: ParsedPayment,
  openOrders: readonly OpenOrder[],
  ledger: LedgerSink,
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
    // No TK ref in the reference — try exact-amount fallback before giving
    // up: a single open order with this exact total is an unambiguous match.
    const byAmount = openOrders.filter(
      (o) => Math.abs(o.totalFc - payment.amountFc) <= AMOUNT_TOLERANCE_FC,
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

  if (Math.abs(order.totalFc - payment.amountFc) > AMOUNT_TOLERANCE_FC) {
    log(
      `SMS ${payment.tkRef}: amount ${payment.amountFc} FC ≠ due ${order.totalFc} FC`,
      order.tkRef,
    );
    return { matched: false, reason: "amount-mismatch" };
  }

  log(`payment matched to ${order.tkRef}`, order.tkRef);
  return { matched: true, order, exact: true };
}

/** FR-P4: has this unmatched payment aged past the escalation window? */
export function needsEscalation(receivedAt: Date, now: Date): boolean {
  return now.getTime() - receivedAt.getTime() >= MATCH_ESCALATION_MS;
}
