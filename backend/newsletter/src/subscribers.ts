import { createHmac, timingSafeEqual } from "node:crypto";
import type { Subscriber } from "./types.js";

/**
 * Consent & unsubscribe. Only registered users who explicitly consented and
 * have NOT unsubscribed are ever emailed — enforced here so no send path can
 * bypass it. Unsubscribe tokens are HMAC-signed so a link cannot be forged
 * to opt someone else out or in.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/** The mailable list: valid email, consented, not unsubscribed. */
export function mailableSubscribers(all: readonly Subscriber[]): Subscriber[] {
  return all.filter(
    (s) => isValidEmail(s.email) && s.consented && !s.unsubscribedAt,
  );
}

export function unsubscribeToken(email: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function unsubscribeUrl(
  baseUrl: string,
  email: string,
  secret: string,
): string {
  const token = unsubscribeToken(email, secret);
  return `${baseUrl}/newsletter/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`;
}

export function verifyUnsubscribe(
  email: string,
  token: string,
  secret: string,
): boolean {
  const expected = Buffer.from(unsubscribeToken(email, secret));
  const provided = Buffer.from(token);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
