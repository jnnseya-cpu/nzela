/**
 * Deterministic state machines + execution guards (spec §6, §18).
 *
 * "A deterministic router decides transitions and validates payloads." No
 * model is in this path. Invalid transitions are rejected, not coerced.
 */

export type OpportunityState =
  | "detected" | "watching" | "eligible" | "dismissed" | "briefed" | "expired";

export type ActionState =
  | "proposed" | "validated" | "pending_approval" | "approved" | "queued"
  | "executing" | "applied" | "failed" | "reconciliation_required" | "rolled_back";

export type Transition<S> = { ok: true; next: S } | { ok: false; error: string };

const OPP: Record<OpportunityState, Partial<Record<string, OpportunityState>>> = {
  detected: { watch: "watching", qualify: "eligible", dismiss: "dismissed", expire: "expired" },
  watching: { qualify: "eligible", dismiss: "dismissed", expire: "expired" },
  eligible: { brief: "briefed", dismiss: "dismissed", expire: "expired" },
  dismissed: { reopen: "detected" },
  briefed: { expire: "expired", dismiss: "dismissed" },
  expired: { reopen: "detected" },
};

const ACTION: Record<ActionState, Partial<Record<string, ActionState>>> = {
  proposed: { validate: "validated", fail: "failed" },
  validated: { request_approval: "pending_approval", fail: "failed" },
  pending_approval: { approve: "approved", reject: "failed" },
  approved: { queue: "queued", invalidate: "validated" }, // edit/expiry invalidates approval
  queued: { start: "executing", fail: "failed" },
  executing: { applied: "applied", fail: "failed", ambiguous: "reconciliation_required" },
  reconciliation_required: { applied: "applied", fail: "failed" },
  applied: { rollback: "rolled_back" },
  failed: {},
  rolled_back: {},
};

export function opportunityTransition(from: OpportunityState, event: string): Transition<OpportunityState> {
  const next = OPP[from]?.[event];
  return next ? { ok: true, next } : { ok: false, error: `invalid opportunity transition: ${from} --${event}-->` };
}

export function actionTransition(from: ActionState, event: string): Transition<ActionState> {
  const next = ACTION[from]?.[event];
  return next ? { ok: true, next } : { ok: false, error: `invalid action transition: ${from} --${event}-->` };
}

// --- Approval guard (§18 step 2): author ≠ approver; no self-approval of a live change ---
export interface ApprovalContext {
  authorId: string;
  approverId: string;
  isLiveChange: boolean;
}
export function canApprove(ctx: ApprovalContext): { ok: true } | { ok: false; reason: string } {
  if (ctx.isLiveChange && ctx.authorId === ctx.approverId) {
    return { ok: false, reason: "SELF_APPROVAL_FORBIDDEN" };
  }
  return { ok: true };
}

// --- Execution re-authorisation (§6, §18 step 3; TI-05) ---
export interface ExecutionContext {
  briefLive: boolean; // brief within its window, re-checked live (not from cache)
  policyMatchesApproval: boolean; // approved policy_version == current
  targetRevisionMatches: boolean; // live target revision == approved expected
  frozen: boolean; // installation/channel freeze active
  entitlementActive: boolean; // not suspended/ended
  approvalBoundToPayloadHash: boolean; // approval bound to exact canonical hash
}
export type ExecDeny =
  | "EXPIRED_OR_REVOKED_BRIEF" | "POLICY_CHANGED" | "TARGET_REVISION_CONFLICT"
  | "FROZEN" | "ENTITLEMENT_INACTIVE" | "APPROVAL_UNBOUND";

/**
 * Re-authorise immediately before execution. A stale/expired brief, changed
 * policy, moved target, freeze, dead entitlement, or unbound approval each
 * DENY execution. (TI-05: an approved brief that expired while queued →
 * executor denies the queued action.)
 */
export function authorizeExecution(ctx: ExecutionContext): { ok: true } | { ok: false; deny: ExecDeny } {
  if (!ctx.briefLive) return { ok: false, deny: "EXPIRED_OR_REVOKED_BRIEF" };
  if (!ctx.entitlementActive) return { ok: false, deny: "ENTITLEMENT_INACTIVE" };
  if (ctx.frozen) return { ok: false, deny: "FROZEN" };
  if (!ctx.policyMatchesApproval) return { ok: false, deny: "POLICY_CHANGED" };
  if (!ctx.approvalBoundToPayloadHash) return { ok: false, deny: "APPROVAL_UNBOUND" };
  if (!ctx.targetRevisionMatches) return { ok: false, deny: "TARGET_REVISION_CONFLICT" };
  return { ok: true };
}
