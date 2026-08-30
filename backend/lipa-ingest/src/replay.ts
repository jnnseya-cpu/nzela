import { FileKV } from "@nzela/persistence";
import type { LedgerSink } from "@nzela/ledger";
import type { ParsedPayment } from "./parsers.js";
import {
  matchPayment,
  DEFAULT_TOLERANCE,
  type MatchResult,
  type MatchTolerance,
  type OpenOrder,
} from "./matcher.js";

/**
 * Replay protection — KODA engine doctrine: a code used once is dead
 * forever. Once a reference (TK ref) or an operator transaction id has
 * produced a successful verification, any later SMS or screenshot reusing
 * it is rejected as a replay, regardless of amount. This is what makes a
 * forwarded/re-forwarded confirmation, or a screenshot shown twice at two
 * cashiers, worthless to a fraudster.
 */

export interface ReplayIndex {
  /** True if this key has already produced a successful verification. */
  has(key: string): boolean;
  add(key: string): void;
}

export class MemoryReplayIndex implements ReplayIndex {
  private readonly seen = new Set<string>();
  has(key: string): boolean {
    return this.seen.has(key);
  }
  add(key: string): void {
    this.seen.add(key);
  }
}

/**
 * Durable, file-backed replay index — the "a code verifies once" guarantee
 * now SURVIVES A RESTART with no external database (single instance). A
 * multi-instance deploy still wants Redis behind this same interface.
 */
export class FileReplayIndex implements ReplayIndex {
  private readonly kv: FileKV;
  constructor(path: string) {
    this.kv = new FileKV(path);
  }
  has(key: string): boolean {
    return this.kv.has(key);
  }
  add(key: string): void {
    this.kv.set(key, 1);
  }
}

export type VerifiedMatch =
  | (MatchResult & { matched: true; replay: false })
  | { matched: false; replay: true; reason: "replayed-reference" }
  | (MatchResult & { matched: false; replay: false });

const refKey = (tkRef: string) => `ref:${tkRef}`;
const txnKey = (operator: string, txnId: string) => `txn:${operator}:${txnId}`;
const contentKey = (dedupHash: string) => `content:${dedupHash}`;

/**
 * matchPayment wrapped with the replay index. On a successful match, both
 * the TK ref and the operator transaction id are burned; either one
 * reappearing later is a replay verdict, logged to the ledger.
 */
export function verifyPayment(
  payment: ParsedPayment,
  openOrders: readonly OpenOrder[],
  index: ReplayIndex,
  ledger: LedgerSink,
  tolerance: MatchTolerance = DEFAULT_TOLERANCE,
): VerifiedMatch {
  const keys: string[] = [];
  if (payment.tkRef) keys.push(refKey(payment.tkRef));
  if (payment.transactionId) {
    keys.push(txnKey(payment.operator, payment.transactionId));
  }
  // Content fingerprint: burns the exact forwarded SMS so it can never
  // verify twice, even for operator formats that carry no transaction id.
  // This is what stops one real (or screenshotted) amount-only confirmation
  // being replayed to settle several same-amount orders.
  if (payment.dedupHash) keys.push(contentKey(payment.dedupHash));

  const replayed = keys.find((k) => index.has(k));
  if (replayed) {
    ledger.write({
      type: "block",
      agent: "lipa",
      purpose: `replay rejected (${replayed}) — a code verifies once`,
      costUsd: 0,
      tkRef: payment.tkRef,
      at: new Date(),
    });
    return { matched: false, replay: true, reason: "replayed-reference" };
  }

  const result = matchPayment(payment, openOrders, ledger, tolerance);
  if (result.matched) {
    keys.push(refKey(result.order.tkRef));
    for (const key of new Set(keys)) index.add(key);
    return { ...result, replay: false };
  }
  return { ...result, replay: false };
}
