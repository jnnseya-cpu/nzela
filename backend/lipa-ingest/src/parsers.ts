import { extractTkRef } from "@nzela/stackfood-client";

/**
 * SMS Ledger Bridge — FR-P1 / Blueprint §3.1. Every mobile-money payment in
 * DRC generates a confirmation SMS to the merchant SIM; the Lipa Box
 * forwards them here. Regex-first parsing (the vision-model fallback for
 * screenshots lives in the Lipa agent, budget $0.0002/call).
 *
 * Formats below are representative of DRC operator confirmations; the
 * pilot's first live SMS from each operator is added to the fixtures and the
 * regexes tightened against real traffic.
 */

export type MobileMoneyOperator =
  | "mpesa"
  | "orange"
  | "airtel"
  | "africell";

export interface ParsedPayment {
  operator: MobileMoneyOperator;
  amountFc: number;
  /** Operator transaction id, e.g. "QGH7X2K9M1". */
  transactionId?: string;
  /** Payer number or name as reported by the operator. */
  payer?: string;
  /** NZELA order ref quoted in the payment reference. */
  tkRef?: string;
}

interface OperatorPattern {
  operator: MobileMoneyOperator;
  /** Identifies the operator from sender id or body. */
  detect: RegExp;
  amount: RegExp;
  transactionId: RegExp;
  payer: RegExp;
}

const AMOUNT = String.raw`([\d][\d\s.,]*)\s*(?:FC|CDF)`;

const PATTERNS: OperatorPattern[] = [
  {
    operator: "mpesa",
    detect: /m-?pesa/i,
    amount: new RegExp(String.raw`(?:reçu|received|recu)\s*${AMOUNT}`, "i"),
    transactionId: /^([A-Z0-9]{8,12})\b|\bID[:\s]+([A-Z0-9]{6,14})/i,
    payer: /de\s+(\+?\d[\d\s]{7,14}|[A-ZÀ-Ü][A-Za-zà-ü\s]{2,30}?)(?=[.,]| ref| réf|$)/i,
  },
  {
    operator: "orange",
    detect: /orange\s*money/i,
    amount: new RegExp(String.raw`(?:reçu|received|recu)\s*${AMOUNT}`, "i"),
    transactionId: /\b(?:Trans(?:action)?\s*ID|TID)[:\s]*([A-Z0-9.]{6,20})/i,
    payer: /(?:de|from)\s+(\+?\d[\d\s]{7,14})/i,
  },
  {
    operator: "airtel",
    detect: /airtel\s*money/i,
    amount: new RegExp(String.raw`(?:reçu|received|recu)\s*${AMOUNT}`, "i"),
    transactionId: /\b(?:Txn|Ref)[.:\s]*([A-Z0-9.]{6,20})/i,
    payer: /(?:de|from)\s+(\+?\d[\d\s]{7,14})/i,
  },
  {
    operator: "africell",
    detect: /africell|afrimoney/i,
    amount: new RegExp(String.raw`(?:reçu|received|recu)\s*${AMOUNT}`, "i"),
    transactionId: /\b(?:Txn|Trans|Ref)[.:\s]*([A-Z0-9.]{6,20})/i,
    payer: /(?:de|from)\s+(\+?\d[\d\s]{7,14})/i,
  },
];

function parseAmount(raw: string): number {
  return Number(raw.replace(/[\s.,](?=\d{3}\b)/g, "").replace(",", "."));
}

/**
 * Parse a forwarded confirmation SMS. `sender` is the forwarding metadata
 * (operator sender id) when available.
 */
export function parseSms(body: string, sender = ""): ParsedPayment | undefined {
  const haystack = `${sender}\n${body}`;
  const pattern = PATTERNS.find((p) => p.detect.test(haystack));
  if (!pattern) return undefined;

  const amountMatch = pattern.amount.exec(body);
  if (!amountMatch?.[1]) return undefined;

  const txnMatch = pattern.transactionId.exec(body);
  const payerMatch = pattern.payer.exec(body);

  return {
    operator: pattern.operator,
    amountFc: parseAmount(amountMatch[1]),
    transactionId: txnMatch?.[1] ?? txnMatch?.[2] ?? undefined,
    payer: payerMatch?.[1]?.trim(),
    tkRef: extractTkRef(body),
  };
}
