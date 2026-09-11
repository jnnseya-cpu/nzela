import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { FileKV } from "./filekv.js";
import { createAesGcmCipher, parseKey, looksEncrypted } from "./crypto.js";

let dir: string;
const KEY = randomBytes(32).toString("base64");
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "nzela-enc-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("AES-256-GCM cipher", () => {
  it("round-trips plaintext", () => {
    const c = createAesGcmCipher(parseKey(KEY));
    const env = c.encrypt("bearer-secret-123");
    expect(env).not.toContain("bearer-secret-123");
    expect(c.decrypt(env)).toBe("bearer-secret-123");
    expect(looksEncrypted(env)).toBe(true);
  });

  it("parseKey accepts base64 and hex, rejects bad keys", () => {
    expect(parseKey(randomBytes(32).toString("base64")).length).toBe(32);
    expect(parseKey(randomBytes(32).toString("hex")).length).toBe(32);
    expect(() => parseKey("too-short")).toThrow(/32-byte/);
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow(/32-byte/);
  });

  it("a different key cannot decrypt (auth failure)", () => {
    const env = createAesGcmCipher(parseKey(KEY)).encrypt("secret");
    const other = createAesGcmCipher(randomBytes(32));
    expect(() => other.decrypt(env)).toThrow();
  });
});

describe("FileKV at-rest encryption", () => {
  it("writes an encrypted envelope (no plaintext secret on disk) and reads back", () => {
    const path = join(dir, "tokens.json");
    const a = new FileKV(path, { encryptionKey: KEY });
    expect(a.encrypted).toBe(true);
    a.set("token:cust:+243810000001", "SUPER-SECRET-BEARER");

    const raw = readFileSync(path, "utf8");
    expect(raw).not.toContain("SUPER-SECRET-BEARER"); // encrypted at rest
    expect(looksEncrypted(raw)).toBe(true);

    // restart with the same key → recovers the value
    const b = new FileKV(path, { encryptionKey: KEY });
    expect(b.get("token:cust:+243810000001")).toBe("SUPER-SECRET-BEARER");
  });

  it("a wrong key FAILS LOUDLY on load (never silently wipes data)", () => {
    const path = join(dir, "s.json");
    new FileKV(path, { encryptionKey: KEY }).set("k", "v");
    const wrong = randomBytes(32).toString("base64");
    expect(() => new FileKV(path, { encryptionKey: wrong })).toThrow();
    // original data is intact (not overwritten by the failed open)
    expect(new FileKV(path, { encryptionKey: KEY }).get("k")).toBe("v");
  });

  it("detects tampering (GCM auth tag)", () => {
    const path = join(dir, "t.json");
    new FileKV(path, { encryptionKey: KEY }).set("k", "v");
    const env = JSON.parse(readFileSync(path, "utf8"));
    env.ct = (env.ct[0] === "A" ? "B" : "A") + env.ct.slice(1); // flip a byte
    writeFileSync(path, JSON.stringify(env));
    expect(() => new FileKV(path, { encryptionKey: KEY })).toThrow();
  });

  it("migrates a legacy plaintext file: reads it, re-writes encrypted", () => {
    const path = join(dir, "legacy.json");
    // legacy plaintext store
    const plain = new FileKV(path);
    plain.set("k", "v");
    expect(looksEncrypted(readFileSync(path, "utf8"))).toBe(false);

    // open with a key → still reads the legacy value…
    const enc = new FileKV(path, { encryptionKey: KEY });
    expect(enc.get("k")).toBe("v");
    // …and the next write encrypts it on disk
    enc.set("k2", "v2");
    expect(looksEncrypted(readFileSync(path, "utf8"))).toBe(true);
    expect(new FileKV(path, { encryptionKey: KEY }).get("k")).toBe("v");
  });

  it("stays fully compatible when no key is given (plaintext, unchanged)", () => {
    const path = join(dir, "p.json");
    const a = new FileKV(path);
    expect(a.encrypted).toBe(false);
    a.set("k", 1);
    expect(looksEncrypted(readFileSync(path, "utf8"))).toBe(false);
    expect(new FileKV(path).get("k")).toBe(1);
  });
});
