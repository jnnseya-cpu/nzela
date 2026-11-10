import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileKV } from "@nzela/persistence";
import {
  ScopedStore, ObservationStore, OwnedSurface, ExecutionService,
  deriveActionKey, approveAction, generateDraft, DeterministicGateway,
  templateAction, type HostAiGateway, type GenRequest,
  briefToSeoDirective, NZELA_PROFILE, GROWTH_BRIEF_FIXTURE,
} from "./index.js";

let dir: string;
let kv: FileKV;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "nzela-ti-act-")); kv = new FileKV(join(dir, "ti.json")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const INST = "nzela_tunakula";
const OTHER = "other_install";

describe("installation-scoped persistence (§15)", () => {
  it("TI-02 · a read for one installation never resolves another's rows", () => {
    const store = new ScopedStore<{ v: number }>(kv, "briefs");
    store.put(INST, "gb_1", { v: 1 });
    expect(store.get(INST, "gb_1")).toEqual({ v: 1 });
    expect(store.get(OTHER, "gb_1")).toBeUndefined(); // cross-installation → not found
    expect(store.list(OTHER)).toEqual([]);
    expect(store.list(INST)).toHaveLength(1);
  });

  it("TI-01 · ingest replays once; exact replay = duplicate; changed hash = conflict", () => {
    const obs = new ObservationStore(kv);
    const row = { source: "first_party", sourceRecord: "ev_1", revision: 1, value: { count: 20 } };
    expect(obs.ingest(INST, [row])).toEqual({ accepted: 1, duplicate: 0, conflict: 0 });
    expect(obs.ingest(INST, [row])).toEqual({ accepted: 0, duplicate: 1, conflict: 0 }); // exact replay
    const changed = { ...row, value: { count: 999 } }; // same key, different hash
    expect(obs.ingest(INST, [changed])).toEqual({ accepted: 0, duplicate: 0, conflict: 1 });
  });
});

describe("native owned-surface activation (§18)", () => {
  it("applies an approved patch, bumps the revision, and serves only the active revision", () => {
    const owned = new OwnedSurface(kv, INST);
    owned.createPage("asset_landing", "/", { title: "Old", description: "d" });
    const res = owned.applyPatch("asset_landing", 1, { title: "New" }, "ak_1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.revision).toBe(2);
    expect(owned.publicRead("asset_landing")?.title).toBe("New");
  });

  it("TI-08 · a stale expected revision conflicts (editor's work protected)", () => {
    const owned = new OwnedSurface(kv, INST);
    owned.createPage("a", "/a", { title: "v1" });
    owned.applyPatch("a", 1, { title: "v2" }, "ak_a"); // now rev 2
    const stale = owned.applyPatch("a", 1, { title: "late" }, "ak_b"); // expected 1, live 2
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.currentRevision).toBe(2);
  });

  it("TI-07 · idempotent on action key + receipt reconciliation recovers one side effect", () => {
    const owned = new OwnedSurface(kv, INST);
    owned.createPage("a", "/a", { title: "v1" });
    const first = owned.applyPatch("a", 1, { title: "v2" }, "ak_x");
    const replay = owned.applyPatch("a", 1, { title: "v2" }, "ak_x"); // same key → no 2nd effect
    expect(first.ok && replay.ok).toBe(true);
    if (first.ok && replay.ok) expect(first.revision).toBe(replay.revision);
    expect(owned.getReceipt("ak_x")).toEqual({ status: "applied", revision: 2 });
    expect(owned.getReceipt("never")).toEqual({ status: "not_found" });
  });

  it("rolls back to previous fields via a compensating action", () => {
    const owned = new OwnedSurface(kv, INST);
    owned.createPage("a", "/a", { title: "v1", description: "keep" });
    owned.applyPatch("a", 1, { title: "v2" }, "ak_1"); // rev 2
    const rb = owned.restorePatch("a", 2, { title: "v1" }, "rb_1"); // rev 3 restores title
    expect(rb.ok).toBe(true);
    expect(owned.publicRead("a")).toMatchObject({ title: "v1", description: "keep" }); // unrelated edit preserved
  });
});

describe("keyless inference (§2/§14)", () => {
  const req: GenRequest = {
    installationId: INST, requestId: "r1", purpose: "seo_draft", schemaRevision: 1,
    directive: briefToSeoDirective(GROWTH_BRIEF_FIXTURE, NZELA_PROFILE),
    deadlineMs: 60_000, tokenLimit: 500,
  };

  it("TI-19/TI-10 · no model → deterministic template draft (workflow continues)", async () => {
    const out = await generateDraft(req, new DeterministicGateway());
    expect(out.mode).toBe("template");
    expect(out.action?.action_kind).toBe("seo_page_draft");
  });

  it("uses a host gateway when it returns valid structured output", async () => {
    const gw: HostAiGateway = {
      capabilities: () => ({ structured: true, embed: false }),
      generateStructured: async () => ({
        action_kind: "seo_page_draft", channel: "seo",
        fields: { title: "Model title" }, evidence_ids: [], approved_claim_ids: [],
      }),
    };
    const out = await generateDraft(req, gw);
    expect(out.mode).toBe("model");
    expect(out.action?.fields.title).toBe("Model title");
  });

  it("invalid/hostile model output falls back to a template (never trusted)", async () => {
    const gw: HostAiGateway = {
      capabilities: () => ({ structured: true, embed: false }),
      generateStructured: async () => ({ action_kind: "grant_publish", spend: 9999 }), // privileged → rejected
    };
    const out = await generateDraft(req, gw);
    expect(out.mode).toBe("template");
    expect(out.status).toBe("fallback");
  });

  it("holds no provider key anywhere in the request/response", () => {
    const a = templateAction(req);
    expect(JSON.stringify(a)).not.toMatch(/api[_-]?key|token|secret|bearer/i);
  });
});

describe("execution service (§6/§18)", () => {
  const liveExec = {
    briefLive: true, policyMatchesApproval: true, targetRevisionMatches: true,
    frozen: false, entitlementActive: true,
  };
  function setup() {
    const owned = new OwnedSurface(kv, INST);
    owned.createPage("asset_landing", "/", { title: "v1" });
    const exec = new ExecutionService(owned);
    const keyParts = {
      installationId: INST, briefVersion: 2, channel: "seo", actionKind: "seo_metadata_patch",
      assetId: "asset_landing", baseRevision: 1, fields: { title: "On-brief title" },
    };
    const appr = approveAction({ fields: keyParts.fields, authorId: "ed1", approverId: "ed2", isLiveChange: true, nowMs: Date.now() });
    if (!appr.ok) throw new Error("approve failed");
    return { owned, exec, keyParts, binding: appr.binding };
  }

  it("executes an approved action and applies it", () => {
    const { exec, keyParts, binding } = setup();
    const r = exec.execute({ keyParts, binding, exec: liveExec });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.revision).toBe(2);
  });

  it("is idempotent — a replayed execute produces no second side effect", () => {
    const { exec, keyParts, binding } = setup();
    const a = exec.execute({ keyParts, binding, exec: liveExec });
    const b = exec.execute({ keyParts, binding, exec: liveExec });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) { expect(a.revision).toBe(b.revision); expect(b.idempotentReplay).toBe(true); }
  });

  it("TI-05 · denies execution when the brief is expired/revoked at exec time", () => {
    const { exec, keyParts, binding } = setup();
    const r = exec.execute({ keyParts, binding, exec: { ...liveExec, briefLive: false } });
    expect(r).toEqual({ ok: false, deny: "EXPIRED_OR_REVOKED_BRIEF" });
  });

  it("forbids self-approval of a live change", () => {
    const bad = approveAction({ fields: { title: "x" }, authorId: "same", approverId: "same", isLiveChange: true, nowMs: 0 });
    expect(bad.ok).toBe(false);
  });

  it("denies when approval is not bound to the exact fields being applied", () => {
    const { exec, keyParts } = setup();
    const wrongBinding = { payloadHash: "deadbeef", approverId: "ed2", authorId: "ed1", approvedAtMs: 0 };
    const r = exec.execute({ keyParts, binding: wrongBinding, exec: liveExec });
    expect(r).toEqual({ ok: false, deny: "APPROVAL_UNBOUND" });
  });
});
