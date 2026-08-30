import { FileKV } from "@nzela/persistence";

/**
 * View-count store. The blog is static HTML with no server, so a real,
 * shared-across-visitors count needs a tiny counter behind it. This is the
 * injected persistence port (in-memory here; Redis `INCR blog:views:<slug>`
 * in production behind the same interface).
 */
export interface ViewStore {
  increment(slug: string): Promise<number>;
  get(slug: string): Promise<number>;
  getMany(slugs: string[]): Promise<Record<string, number>>;
}

export class MemoryViewStore implements ViewStore {
  private readonly counts = new Map<string, number>();

  async increment(slug: string): Promise<number> {
    const n = (this.counts.get(slug) ?? 0) + 1;
    this.counts.set(slug, n);
    return n;
  }
  async get(slug: string): Promise<number> {
    return this.counts.get(slug) ?? 0;
  }
  async getMany(slugs: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const s of slugs) out[s] = this.counts.get(s) ?? 0;
    return out;
  }
}

/**
 * Durable, file-backed view store — the counter SURVIVES A RESTART with no
 * external database (single instance). A multi-instance deploy still wants
 * Redis (INCR) behind this same interface.
 */
export class FileViewStore implements ViewStore {
  private readonly kv: FileKV;
  constructor(path: string) {
    this.kv = new FileKV(path);
  }
  async increment(slug: string): Promise<number> {
    const n = (this.kv.get<number>(slug) ?? 0) + 1;
    this.kv.set(slug, n);
    return n;
  }
  async get(slug: string): Promise<number> {
    return this.kv.get<number>(slug) ?? 0;
  }
  async getMany(slugs: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const s of slugs) out[s] = this.kv.get<number>(s) ?? 0;
    return out;
  }
}

/** Only clean post slugs are accepted as counter keys (no junk / injection). */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function validSlug(slug: unknown): slug is string {
  return typeof slug === "string" && slug.length <= 80 && SLUG_RE.test(slug);
}
