import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * StackFood observer webhook verification — Integration Spec §7.2 / FR-S2.
 * The Laravel OrderObserver module signs each push with
 * `X-NZELA-Signature: hmac_sha256(body, shared_secret)`.
 */

export function signWebhook(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = Buffer.from(signWebhook(body, secret), "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
