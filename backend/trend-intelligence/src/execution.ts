import type { LedgerSink } from "@nzela/ledger";
import { canonicalHash } from "./store.js";
import { OwnedSurface, type OwnedFields, type PatchResult } from "./owned-surface.js";
import { authorizeExecution, canApprove, type ExecutionContext, type ExecDeny } from "./state.js";

/**
 * Action execution (spec §6, §18) — the approval-gated, idempotent, reversible
 * write path, embedded and invisible. It derives a durable idempotency key,
 * re-authorises at execution time (a stale/expired brief, moved target, freeze
 * or dead entitlement denies), applies the patch to the owned surface, and
 * supports a safe rollback. All file-backed; no third-party egress.
 */

export interface ActionKeyParts {
  installationId: string;
  briefVersion: number;
  channel: string;
  actionKind: string;
  assetId: string;
  baseRevision: number;
  fields: OwnedFields;
}

/** Durable idempotency key (§6/§15): identical intent ⇒ identical key. */
export function deriveActionKey(p: ActionKeyParts): string {
  const patchHash = canonicalHash(p.fields);
  return canonicalHash([
    p.installationId, p.briefVersion, p.channel, p.actionKind, p.assetId, p.baseRevision, patchHash,
  ]).slice(0, 32);
}

export interface ApprovalBinding {
  payloadHash: string;
  approverId: string;
  authorId: string;
  approvedAtMs: number;
}

/** Bind an approval to the exact canonical payload (§18 step 2; self-approval of a live change is forbidden). */
export function approveAction(args: {
  fields: OwnedFields;
  authorId: string;
  approverId: string;
  isLiveChange: boolean;
  nowMs: number;
}): { ok: true; binding: ApprovalBinding } | { ok: false; reason: string } {
  const guard = canApprove(args);
  if (!guard.ok) return { ok: false, reason: guard.reason };
  return {
    ok: true,
    binding: { payloadHash: canonicalHash(args.fields), approverId: args.approverId, authorId: args.authorId, approvedAtMs: args.nowMs },
  };
}

export type ExecuteResult =
  | { ok: true; revision: number; actionKey: string; idempotentReplay: boolean }
  | { ok: false; deny: ExecDeny }
  | { ok: false; conflict: true; currentRevision: number };

export class ExecutionService {
  constructor(
    private readonly owned: OwnedSurface,
    private readonly ledger?: LedgerSink,
  ) {}

  /**
   * Execute an approved action. `binding` must match the fields being applied,
   * `exec` is re-checked live. Idempotent: the same action key never produces a
   * second side effect.
   */
  execute(args: {
    keyParts: ActionKeyParts;
    binding: ApprovalBinding;
    exec: Omit<ExecutionContext, "approvalBoundToPayloadHash">;
  }): ExecuteResult {
    const { keyParts, binding, exec } = args;
    const actionKey = deriveActionKey(keyParts);

    // Approval must be bound to exactly these fields.
    const approvalBoundToPayloadHash = binding.payloadHash === canonicalHash(keyParts.fields);
    const auth = authorizeExecution({ ...exec, approvalBoundToPayloadHash });
    if (!auth.ok) {
      this.audit(`execute denied ${keyParts.assetId}: ${auth.deny}`, keyParts.installationId);
      return { ok: false, deny: auth.deny };
    }

    const already = this.owned.getReceipt(actionKey);
    const res: PatchResult = this.owned.applyPatch(keyParts.assetId, keyParts.baseRevision, keyParts.fields, actionKey);
    if (!res.ok) {
      this.audit(`execute conflict ${keyParts.assetId} @${keyParts.baseRevision}`, keyParts.installationId);
      return { ok: false, conflict: true, currentRevision: res.currentRevision };
    }
    const idempotentReplay = already.status === "applied";
    this.audit(`execute applied ${keyParts.assetId} → rev ${res.revision}${idempotentReplay ? " (replay)" : ""}`, keyParts.installationId);
    return { ok: true, revision: res.revision, actionKey, idempotentReplay };
  }

  /** Receipt reconciliation after an ambiguous completion (TI-07). */
  reconcile(actionKey: string): { applied: boolean; revision?: number } {
    const r = this.owned.getReceipt(actionKey);
    return r.status === "applied" ? { applied: true, revision: r.revision } : { applied: false };
  }

  /** Authorised compensating rollback (§18 step 6). Still permitted under freeze. */
  rollback(args: {
    installationId: string;
    assetId: string;
    appliedRevision: number;
    previousFields: OwnedFields;
    rollbackKey: string;
  }): ExecuteResult {
    const res = this.owned.restorePatch(args.assetId, args.appliedRevision, args.previousFields, args.rollbackKey);
    if (!res.ok) return { ok: false, conflict: true, currentRevision: res.currentRevision };
    this.audit(`rollback ${args.assetId} → rev ${res.revision}`, args.installationId);
    return { ok: true, revision: res.revision, actionKey: args.rollbackKey, idempotentReplay: false };
  }

  private audit(purpose: string, installationId: string): void {
    this.ledger?.write({ type: "deterministic", agent: "growth", purpose: `[${installationId}] ${purpose}`, costUsd: 0, at: new Date() });
  }
}
