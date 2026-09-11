import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * Authenticated at-rest encryption for the file-backed stores (AES-256-GCM).
 * GCM gives us confidentiality AND integrity: a tampered ciphertext fails the
 * auth-tag check on decrypt, so a corrupted or altered store file is detected,
 * not silently trusted.
 *
 * Envelope on disk (JSON): { v, alg, iv, tag, ct } — all base64. The `alg`
 * marker lets a reader tell an encrypted file from a legacy plaintext one, so
 * turning encryption on migrates existing files transparently on next write.
 */

const ALG = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length

export interface Cipher {
  /** plaintext → envelope JSON string written to disk. */
  encrypt(plaintext: string): string;
  /** envelope JSON string → plaintext. Throws on wrong key / tamper. */
  decrypt(envelope: string): string;
}

interface Envelope {
  v: 1;
  alg: typeof ALG;
  iv: string;
  tag: string;
  ct: string;
}

function isEnvelope(x: unknown): x is Envelope {
  return (
    !!x &&
    typeof x === "object" &&
    (x as { alg?: unknown }).alg === ALG &&
    typeof (x as { ct?: unknown }).ct === "string"
  );
}

/** True if a file's raw contents are an encryption envelope (vs plaintext). */
export function looksEncrypted(raw: string): boolean {
  try {
    return isEnvelope(JSON.parse(raw));
  } catch {
    return false;
  }
}

/**
 * Parse a 32-byte key from an env string. Accepts base64 (recommended, e.g.
 * `openssl rand -base64 32`) or hex (64 chars). Rejects anything not exactly
 * 32 bytes — a short/garbage key must fail loudly, never weaken silently.
 */
export function parseKey(raw: string): Buffer {
  const s = raw.trim();
  let key: Buffer | undefined;
  if (/^[0-9a-fA-F]{64}$/.test(s)) key = Buffer.from(s, "hex");
  else {
    try {
      const b = Buffer.from(s, "base64");
      if (b.length === 32) key = b;
    } catch {
      /* not base64 */
    }
  }
  if (!key || key.length !== 32) {
    throw new Error(
      "DATA_ENCRYPTION_KEY must be a 32-byte key (base64, e.g. `openssl rand -base64 32`, or 64 hex chars)",
    );
  }
  return key;
}

export function createAesGcmCipher(key: Buffer): Cipher {
  if (key.length !== 32) throw new Error("AES-256-GCM requires a 32-byte key");
  return {
    encrypt(plaintext: string): string {
      const iv = randomBytes(IV_BYTES);
      const c = createCipheriv(ALG, key, iv);
      const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
      const tag = c.getAuthTag();
      const env: Envelope = {
        v: 1,
        alg: ALG,
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        ct: ct.toString("base64"),
      };
      return JSON.stringify(env);
    },
    decrypt(envelope: string): string {
      const env = JSON.parse(envelope) as unknown;
      if (!isEnvelope(env)) throw new Error("not an AES-GCM envelope");
      const d = createDecipheriv(ALG, key, Buffer.from(env.iv, "base64"));
      d.setAuthTag(Buffer.from(env.tag, "base64"));
      const pt = Buffer.concat([
        d.update(Buffer.from(env.ct, "base64")),
        d.final(), // throws if the tag doesn't verify (wrong key or tamper)
      ]);
      return pt.toString("utf8");
    },
  };
}

/** Build a cipher from a raw key string, or undefined when no key is given. */
export function cipherFromKey(raw: string | Buffer | undefined): Cipher | undefined {
  if (raw === undefined || raw === "") return undefined;
  const key = Buffer.isBuffer(raw) ? raw : parseKey(raw);
  return createAesGcmCipher(key);
}
