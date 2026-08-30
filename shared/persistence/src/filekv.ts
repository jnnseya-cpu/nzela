import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { dirname } from "node:path";

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
 * Single-instance scope: the in-memory cache is not shared between processes,
 * so a horizontally-scaled deployment still wants Redis/Postgres behind the
 * same interfaces. For one gateway/lipa instance this is genuine durability.
 */
export class FileKV {
  private cache: Record<string, unknown>;

  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.cache = this.load();
  }

  private load(): Record<string, unknown> {
    try {
      const raw = readFileSync(this.path, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {}; // missing or corrupt → start empty (never throw on boot)
    }
  }

  private flush(): void {
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.cache));
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
