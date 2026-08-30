import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileKV } from "./filekv.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "nzela-kv-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("FileKV — durable across restart", () => {
  it("persists writes to a fresh instance (simulated restart)", () => {
    const path = join(dir, "store.json");
    const a = new FileKV(path);
    a.set("k1", 42);
    a.set("k2", { nested: true });
    expect(existsSync(path)).toBe(true);

    // A new instance = a process restart reading the same file.
    const b = new FileKV(path);
    expect(b.get("k1")).toBe(42);
    expect(b.get<{ nested: boolean }>("k2")).toEqual({ nested: true });
    expect(b.has("k1")).toBe(true);
    expect(b.keys().sort()).toEqual(["k1", "k2"]);
  });

  it("delete persists too", () => {
    const path = join(dir, "store.json");
    const a = new FileKV(path);
    a.set("gone", 1);
    a.delete("gone");
    expect(new FileKV(path).has("gone")).toBe(false);
  });

  it("starts empty on a missing or corrupt file (never throws on boot)", () => {
    expect(new FileKV(join(dir, "nope.json")).keys()).toEqual([]);
    const corrupt = join(dir, "bad.json");
    new FileKV(corrupt).set("x", 1);
    // overwrite with garbage, then reopen
    require("node:fs").writeFileSync(corrupt, "{not json");
    expect(new FileKV(corrupt).keys()).toEqual([]);
  });
});
