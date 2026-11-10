import { describe, it, expect } from "vitest";
import {
  opportunityTransition, actionTransition, canApprove, authorizeExecution,
  type ExecutionContext,
} from "./state.js";
import {
  parseProposedAction, parseModelAction, isLiveActionKind,
} from "./action.js";

describe("state machines (§6)", () => {
  it("allows valid opportunity transitions and rejects invalid ones", () => {
    expect(opportunityTransition("detected", "qualify")).toEqual({ ok: true, next: "eligible" });
    expect(opportunityTransition("eligible", "brief")).toEqual({ ok: true, next: "briefed" });
    expect(opportunityTransition("expired", "brief").ok).toBe(false);
  });
  it("allows valid action transitions and rejects invalid ones", () => {
    expect(actionTransition("proposed", "validate")).toEqual({ ok: true, next: "validated" });
    expect(actionTransition("approved", "queue")).toEqual({ ok: true, next: "queued" });
    expect(actionTransition("applied", "rollback")).toEqual({ ok: true, next: "rolled_back" });
    expect(actionTransition("failed", "start").ok).toBe(false); // terminal
  });
});

describe("approval guard (§18)", () => {
  it("forbids self-approval of a live change", () => {
    expect(canApprove({ authorId: "u1", approverId: "u1", isLiveChange: true }).ok).toBe(false);
    expect(canApprove({ authorId: "u1", approverId: "u2", isLiveChange: true }).ok).toBe(true);
    expect(canApprove({ authorId: "u1", approverId: "u1", isLiveChange: false }).ok).toBe(true); // draft
  });
});

describe("execution re-authorisation (§18)", () => {
  const good: ExecutionContext = {
    briefLive: true, policyMatchesApproval: true, targetRevisionMatches: true,
    frozen: false, entitlementActive: true, approvalBoundToPayloadHash: true,
  };
  it("authorises when every guard passes", () => {
    expect(authorizeExecution(good)).toEqual({ ok: true });
  });
  it("denies on each failing guard with a typed reason", () => {
    expect(authorizeExecution({ ...good, briefLive: false })).toEqual({ ok: false, deny: "EXPIRED_OR_REVOKED_BRIEF" });
    expect(authorizeExecution({ ...good, frozen: true })).toEqual({ ok: false, deny: "FROZEN" });
    expect(authorizeExecution({ ...good, targetRevisionMatches: false })).toEqual({ ok: false, deny: "TARGET_REVISION_CONFLICT" });
    expect(authorizeExecution({ ...good, entitlementActive: false })).toEqual({ ok: false, deny: "ENTITLEMENT_INACTIVE" });
  });
});

describe("typed action validation (§18)", () => {
  const valid = {
    action_kind: "seo_metadata_patch", channel: "seo",
    fields: { title: "New title", description: "New desc" },
    evidence_ids: ["ev_1"], approved_claim_ids: ["claim_1"],
  };
  it("accepts a well-formed proposed action", () => {
    const r = parseProposedAction(valid);
    expect(r.ok).toBe(true);
  });
  it("classifies live vs draft kinds", () => {
    expect(isLiveActionKind("seo_metadata_patch")).toBe(true);
    expect(isLiveActionKind("seo_page_draft")).toBe(false);
  });
  it("rejects fields outside the allowlist (no canonical/robots/redirects)", () => {
    const r = parseProposedAction({ ...valid, fields: { canonical: "https://evil" } });
    expect(r.ok).toBe(false);
  });
  it("rejects invalid JSON from a model", () => {
    expect(parseModelAction("{not json").ok).toBe(false);
  });
});
