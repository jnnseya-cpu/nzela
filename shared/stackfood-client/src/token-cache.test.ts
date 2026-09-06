import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileTokenCache, tokenCacheKey } from "./auth.js";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "nzela-tok-"));
  dirs.push(d);
  return join(d, "tokens.json");
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("FileTokenCache", () => {
  it("stores, reads and deletes tokens", async () => {
    const cache = new FileTokenCache(tmp());
    const key = tokenCacheKey("+243810000001");
    expect(await cache.get(key)).toBeUndefined();
    await cache.set(key, "bearer-abc");
    expect(await cache.get(key)).toBe("bearer-abc");
    await cache.delete(key);
    expect(await cache.get(key)).toBeUndefined();
  });

  it("survives a restart — a fresh instance sees committed tokens", async () => {
    const path = tmp();
    const key = tokenCacheKey("+243810000002");
    await new FileTokenCache(path).set(key, "bearer-restart");
    // Simulate a process restart: brand-new instance, same file.
    const reborn = new FileTokenCache(path);
    expect(await reborn.get(key)).toBe("bearer-restart");
  });
});
