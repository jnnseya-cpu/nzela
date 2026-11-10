import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileKV } from "@nzela/persistence";
import { MemoryLedger } from "@nzela/ledger";
import {
  NZELA_PROFILE, TrendCoordinator, type NzelaSignal, type AssessContext,
  briefToSeoDirective, generateDraft, DeterministicGateway,
  OwnedSurface, ExecutionService, approveAction, deriveActionKey,
  NativeMeasurement,
} from "./index.js";

/**
 * Keyless release-gate (spec §20) — deterministic subset provable here.
 * Runs the FULL loop with NO model, NO provider key and NO external egress:
 * first-party signals → scored brief → template draft → approve → apply to the
 * native owned surface → measure outcomes → rollback. Everything file-backed.
 */

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "nzela-gate-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const NOW = Date.parse("2026-11-10T12:00:00Z");
const HOUR = 3_600_000;
const INST = "nzela_tunakula";

describe("§20 keyless gate (deterministic, no model, no egress)", () => {
  it("signals → brief → template draft → approve → apply → measure → rollback", async () => {
    const kv = new FileKV(join(dir, "ti.json"));
    const ledger = new MemoryLedger();

    // 1. First-party signals (two independent families) for a topic.
    const topic = "mobile-money-paiement";
    const coord = new TrendCoordinator(NZELA_PROFILE, ledger);
    for (let i = 0; i < 10; i++) {
      coord.record({ kind: "payment_verified", topic, atMs: NOW - i * 60_000, dedupKey: `TK-${i}`, market: "CD" } satisfies NzelaSignal);
    }
    coord.record({ kind: "conversation_intent", topic, atMs: NOW - HOUR, dedupKey: "q1", market: "CD" });
    coord.record({ kind: "conversation_intent", topic, atMs: NOW - 2 * HOUR, dedupKey: "q2", market: "CD" });

    // 2. Score → reviewable Growth Brief.
    const ctx: AssessContext = { nowMs: NOW, baselineCount: 4, history: [3, 4, 5, 4, 3, 4], freshnessMs: 24 * HOUR, timing: 90, readiness: 90 };
    const built = coord.buildBrief(topic, {
      ctx, briefId: "gb_gate_1", briefVersion: 1, tenantId: INST,
      evidenceIds: ["ev_1", "ev_2"], policyVersion: 1, experimentId: "exp_1",
    });
    expect(built.brief).not.toBeNull();
    const brief = built.brief!;

    // 3. Brief → SEO directive → DETERMINISTIC template draft (no model).
    const directive = briefToSeoDirective(brief, NZELA_PROFILE);
    const gen = await generateDraft(
      { installationId: INST, requestId: "r1", purpose: "seo_draft", schemaRevision: 1, directive, deadlineMs: 60_000, tokenLimit: 500 },
      new DeterministicGateway(),
    );
    expect(gen.mode).toBe("template");
    const fields = gen.action!.fields; // { title, description, body_block }

    // 4. Create the native page, approve, and apply the patch (two reviewers).
    const owned = new OwnedSurface(kv, INST);
    owned.createPage("asset_landing", "/", { title: "Ancien titre" });
    const appr = approveAction({ fields, authorId: "ed1", approverId: "ed2", isLiveChange: true, nowMs: NOW });
    expect(appr.ok).toBe(true);
    const exec = new ExecutionService(owned, ledger);
    const keyParts = {
      installationId: INST, briefVersion: brief.brief_version, channel: "seo",
      actionKind: "seo_metadata_patch", assetId: "asset_landing", baseRevision: 1, fields,
    };
    const applied = exec.execute({
      keyParts,
      binding: appr.ok ? appr.binding : (() => { throw new Error(); })(),
      exec: { briefLive: true, policyMatchesApproval: true, targetRevisionMatches: true, frozen: false, entitlementActive: true },
    });
    expect(applied.ok).toBe(true);
    expect(owned.publicRead("asset_landing")?.title).toBe(fields.title); // live change visible as normal page content

    // 5. Native measurement: eligible visits + CTA outcomes, small-cohort suppressed.
    const m = new NativeMeasurement(kv, INST, 30);
    for (let i = 0; i < 40; i++) m.recordVisit("asset_landing", 2);
    for (let i = 0; i < 6; i++) m.recordCtaOutcome("asset_landing", 2);
    const report = m.report("asset_landing");
    const row = report.find((r) => r.revision === 2)!;
    expect(row.sample).toBe("ok");
    expect(row.rate).toBeCloseTo(6 / 40, 10);

    // 6. Rollback restores the prior revision (reversible owned change).
    const applKey = applied.ok ? deriveActionKey(keyParts) : "";
    expect(applKey).not.toBe("");
    const rb = exec.rollback({ installationId: INST, assetId: "asset_landing", appliedRevision: 2, previousFields: { title: "Ancien titre" }, rollbackKey: "rb_1" });
    expect(rb.ok).toBe(true);
    expect(owned.publicRead("asset_landing")?.title).toBe("Ancien titre");

    // Audit connects the stages; no provider key anywhere.
    expect(ledger.events.some((e) => /execute applied/.test(e.purpose))).toBe(true);
    expect(JSON.stringify(ledger.events)).not.toMatch(/api[_-]?key|bearer|secret/i);
  });
});
