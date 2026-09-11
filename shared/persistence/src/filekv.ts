import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { dirname } from "node:path";
import { type Cipher, cipherFromKey, looksEncrypted } from "./crypto.js";

/**
 * Durable key-value store backed by an atomic JSON file. This replaces the
 * in-memory placeholders for the money-critical guarantees (verify-once,
 * reward-once, ACU balances) so they SURVIVE A RESTART with no external
 * database. Real and working for a single instance:
 *
 * - Writes are atomic: a temp file is written then `rename`d over the target
 *   (rename is atomic on the same filesystem), so a crash mid-write never
 *   leaves a half-written or empty file.
 * - On construction it loads the existing file, so a fresh process (a
 *   restart) sees everything the previous one committed.
 *
 * At-rest encryption (optional): pass an `encryptionKey` and the file is
 * written as an AES-256-GCM envelope instead of plaintext. Used for the
 * token / PII / financial stores so a stolen disk or backup does not leak
 * StackFood tokens, customer phone numbers/addresses, or balances. Turning
 * it on migrates an existing plaintext file transparently on the next write;
 * a wrong key FAILS LOUDLY on load (it never silently wipes real data).
 *
 * Single-instance scope: the in-memory cache is not shared between processes,
 * so a horizontally-scaled deployment still wants Redis/Postgres behind the
 * same interfaces. For one gateway/lipa instance this is genuine durability.
 */
export interface FileKVOptions {
  /** 32-byte key (base64/hex string or Buffer). Absent → plaintext on disk. */
  encryptionKey?: string | Buffer;
}

export class FileKV {
  private cache: Record<string, unknown>;
  private readonly cipher: Cipher | undefined;

  constructor(private readonly path: string, opts: FileKVOptions = {}) {
    this.cipher = cipherFromKey(opts.encryptionKey);
    mkdirSync(dirname(path), { recursive: true });
    this.cache = this.load();
  }

  /** True when this store writes encrypted (a key was supplied). */
  get encrypted(): boolean {
    return this.cipher !== undefined;
  }

  private load(): Record<string, unknown> {
    let raw: string;
    try {
      raw = readFileSync(this.path, "utf8");
    } catch {
      return {}; // missing file → start empty (never throw on a fresh boot)
    }
    if (!raw.trim()) return {};

    // Encrypted-at-rest path: decrypt failure MUST throw, never fall back to
    // empty — a wrong key would otherwise be "recovered" as {} and the next
    // write would overwrite real encrypted data with an empty store.
    if (this.cipher && looksEncrypted(raw)) {
      const plain = this.cipher.decrypt(raw); // throws on wrong key / tamper
      return this.parseObject(plain);
    }
    // Plaintext on disk. If a key is configured this is a legacy file being
    // migrated — read it now; the next flush re-writes it encrypted.
    try {
      return this.parseObject(raw);
    } catch {
      return {}; // genuinely corrupt plaintext → start empty (legacy behavior)
    }
  }

  private parseObject(s: string): Record<string, unknown> {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  private flush(): void {
    const plain = JSON.stringify(this.cache);
    const data = this.cipher ? this.cipher.encrypt(plain) : plain;
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, data);
    renameSync(tmp, this.path);
  }

  get<T>(key: string): T | undefined {
    return this.cache[key] as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.cache[key] = value;
    this.flush();
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.cache, key);
  }

  delete(key: string): void {
    if (this.has(key)) {
      delete this.cache[key];
      this.flush();
    }
  }

  keys(): string[] {
    return Object.keys(this.cache);
  }
}
