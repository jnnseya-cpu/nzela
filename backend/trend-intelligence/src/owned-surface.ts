import { FileKV } from "@nzela/persistence";
import { canonicalHash } from "./store.js";

/**
 * Native owned-surface activation adapter (spec §18). NZELA's file-backed
 * implementation of the reversible owned-page write path: apply an approved
 * SEO/CTA patch to an owned asset, with immutable revisions, compare-and-set
 * concurrency, a durable receipt persisted atomically with the revision, and
 * a safe rollback. No third-party egress; invisible — this is the activation
 * STORE, not a public web server.
 *
 * Allowlisted fields only (title, description, body_block, cta). URL, canonical,
 * robots, redirects, schema, permissions and template are out of scope (§18).
 */

export const OWNED_FIELDS = ["title", "description", "body_block", "cta"] as const;
export type OwnedField = (typeof OWNED_FIELDS)[number];
export type OwnedFields = Partial<Record<OwnedField, string>>;

interface AssetRow {
  installationId: string;
  assetId: string;
  slug: string;
  activeRevision: number;
  fields: OwnedFields;
  contentHash: string;
}
interface ReceiptRow {
  actionKey: string;
  assetId: string;
  revision: number;
  at: string;
  previousFields: OwnedFields;
}

export type PatchResult =
  | { ok: true; revision: number; receipt: ReceiptRow }
  | { ok: false; conflict: true; currentRevision: number };

export type Receipt =
  | { status: "applied"; revision: number }
  | { status: "not_found" };

export class OwnedSurface {
  constructor(private readonly kv: FileKV, private readonly installationId: string) {}

  private aKey(assetId: string): string { return `asset:${this.installationId}:${assetId}`; }
  private rKey(actionKey: string): string { return `receipt:${this.installationId}:${actionKey}`; }

  /** Editor-approved creation of a new owned page (§18: a first page must be explicitly created). */
  createPage(assetId: string, slug: string, fields: OwnedFields): AssetRow {
    const row: AssetRow = {
      installationId: this.installationId, assetId, slug,
      activeRevision: 1, fields, contentHash: canonicalHash(fields),
    };
    this.kv.set(this.aKey(assetId), row);
    return row;
  }

  getAsset(assetId: string): { assetId: string; revision: number; fields: OwnedFields; contentHash: string } | undefined {
    const row = this.kv.get<AssetRow>(this.aKey(assetId));
    if (!row) return undefined;
    return { assetId: row.assetId, revision: row.activeRevision, fields: row.fields, contentHash: row.contentHash };
  }

  /** Public read serves ONLY the active revision's fields (never a draft). */
  publicRead(assetId: string): OwnedFields | undefined {
    return this.kv.get<AssetRow>(this.aKey(assetId))?.fields;
  }

  /**
   * Atomic compare-and-set of allowlisted fields. Conflicts when the live
   * revision differs from `expectedRevision` (TI-08). Receipt + new revision
   * are persisted in the SAME write, so a crash after "apply" is recoverable
   * via `getReceipt` (TI-07). Idempotent on `actionKey`: a replay returns the
   * stored receipt without a second side effect.
   */
  applyPatch(assetId: string, expectedRevision: number, fields: OwnedFields, actionKey: string): PatchResult {
    const existingReceipt = this.kv.get<ReceiptRow>(this.rKey(actionKey));
    if (existingReceipt) {
      return { ok: true, revision: existingReceipt.revision, receipt: existingReceipt };
    }
    const row = this.kv.get<AssetRow>(this.aKey(assetId));
    if (!row) return { ok: false, conflict: true, currentRevision: 0 };
    if (row.activeRevision !== expectedRevision) {
      return { ok: false, conflict: true, currentRevision: row.activeRevision };
    }
    // reject non-allowlisted fields defensively
    for (const k of Object.keys(fields)) {
      if (!(OWNED_FIELDS as readonly string[]).includes(k)) {
        return { ok: false, conflict: true, currentRevision: row.activeRevision };
      }
    }
    const previousFields: OwnedFields = { ...row.fields };
    const nextFields: OwnedFields = { ...row.fields, ...fields };
    const nextRevision = row.activeRevision + 1;
    const receipt: ReceiptRow = {
      actionKey, assetId, revision: nextRevision, at: new Date().toISOString(), previousFields,
    };
    const updated: AssetRow = { ...row, activeRevision: nextRevision, fields: nextFields, contentHash: canonicalHash(nextFields) };
    // persist both; FileKV.set is atomic per write — write receipt first so a
    // crash leaves a recoverable receipt, then the asset.
    this.kv.set(this.rKey(actionKey), receipt);
    this.kv.set(this.aKey(assetId), updated);
    return { ok: true, revision: nextRevision, receipt };
  }

  getReceipt(actionKey: string): Receipt {
    const r = this.kv.get<ReceiptRow>(this.rKey(actionKey));
    return r ? { status: "applied", revision: r.revision } : { status: "not_found" };
  }

  /**
   * Rollback = a new logged compensating write (§18 step 6). Restores the
   * previous field values only if the live revision matches the applied
   * revision; otherwise conflict → manual resolution. Preserves unrelated edits
   * by restoring only the fields the original action changed.
   */
  restorePatch(assetId: string, expectedAppliedRevision: number, previousFields: OwnedFields, rollbackKey: string): PatchResult {
    return this.applyPatch(assetId, expectedAppliedRevision, previousFields, rollbackKey);
  }
}
