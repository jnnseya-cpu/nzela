import { createHash } from "node:crypto";
import { FileKV } from "@nzela/persistence";

/**
 * Installation-scoped persistence (spec §15) — NZELA's file-backed substitute
 * for "Postgres + row-level security". The installation is the tenancy
 * boundary: every key is prefixed with `installation_id`, and a read for one
 * installation can NEVER resolve another's rows (TI-02). File-backed so it is
 * durable on a single instance and encryptable at rest (same FileKV as the
 * rest of NZELA).
 */

/** Canonical, stable hash of any JSON-able value (order-independent for objects). */
export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

/** A collection of rows, every one bound to an installation (composite key). */
export class ScopedStore<T> {
  constructor(private readonly kv: FileKV, private readonly collection: string) {}

  private key(installationId: string, id: string): string {
    return `${this.collection}:${installationId}:${id}`;
  }

  put(installationId: string, id: string, value: T): void {
    this.kv.set(this.key(installationId, id), value);
  }

  /** Returns the row ONLY if it belongs to this installation; else undefined. */
  get(installationId: string, id: string): T | undefined {
    return this.kv.get<T>(this.key(installationId, id));
  }

  has(installationId: string, id: string): boolean {
    return this.kv.has(this.key(installationId, id));
  }

  /** All rows for one installation (never another's). */
  list(installationId: string): T[] {
    const prefix = `${this.collection}:${installationId}:`;
    return this.kv.keys().filter((k) => k.startsWith(prefix)).map((k) => this.kv.get<T>(k)!).filter(Boolean);
  }

  delete(installationId: string, id: string): void {
    this.kv.delete(this.key(installationId, id));
  }
}

export type IdempotencyOutcome<R> =
  | { status: "new" }
  | { status: "duplicate"; response: R }
  | { status: "conflict" };

/**
 * Idempotency store (spec §6, §16): an identical replay returns the stored
 * response; the SAME key with a DIFFERENT canonical payload is a conflict
 * (409). Backs ingest replay protection and action idempotency.
 */
export class IdempotencyStore<R = unknown> {
  constructor(private readonly kv: FileKV, private readonly collection: string) {}

  private key(installationId: string, logicalKey: string): string {
    return `idem:${this.collection}:${installationId}:${logicalKey}`;
  }

  check(installationId: string, logicalKey: string, payloadHash: string): IdempotencyOutcome<R> {
    const rec = this.kv.get<{ payloadHash: string; response: R }>(this.key(installationId, logicalKey));
    if (!rec) return { status: "new" };
    return rec.payloadHash === payloadHash
      ? { status: "duplicate", response: rec.response }
      : { status: "conflict" };
  }

  save(installationId: string, logicalKey: string, payloadHash: string, response: R): void {
    this.kv.set(this.key(installationId, logicalKey), { payloadHash, response });
  }
}

export interface IngestResult {
  accepted: number;
  duplicate: number;
  conflict: number;
}

/**
 * Observation ingest with replay protection (§5, TI-01). Unique key is
 * (source, source_record, revision); a changed value under the same key is a
 * conflict. Scoped per installation.
 */
export class ObservationStore {
  private readonly idem: IdempotencyStore<true>;
  constructor(kv: FileKV) {
    this.idem = new IdempotencyStore<true>(kv, "observations");
  }
  ingest(
    installationId: string,
    rows: readonly { source: string; sourceRecord: string; revision: number; value: unknown }[],
  ): IngestResult {
    let accepted = 0, duplicate = 0, conflict = 0;
    for (const r of rows) {
      const logicalKey = `${r.source}:${r.sourceRecord}:${r.revision}`;
      const hash = canonicalHash(r.value);
      const out = this.idem.check(installationId, logicalKey, hash);
      if (out.status === "new") { this.idem.save(installationId, logicalKey, hash, true); accepted++; }
      else if (out.status === "duplicate") duplicate++;
      else conflict++;
    }
    return { accepted, duplicate, conflict };
  }
}
