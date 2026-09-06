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

/**
 * WhatsApp Cloud API inbound webhook verification — Meta signs every POST
 * with `X-Hub-Signature-256: sha256=<hmac_sha256(rawBody, app_secret)>`.
 * We MUST verify this on the raw request body before trusting a single
 * inbound message, otherwise anyone who learns the webhook URL can inject
 * fake customer messages (and drive real orders/replies). Constant-time
 * compare; tolerant of the `sha256=` prefix being present or absent.
 */
export function verifyMetaSignature(
  rawBody: string,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (typeof header !== "string") return false;
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = Buffer.from(signWebhook(rawBody, appSecret), "hex");
  let got: Buffer;
  try {
    got = Buffer.from(provided, "hex");
  } catch {
    return false;
  }
  return got.length === expected.length && timingSafeEqual(got, expected);
}
