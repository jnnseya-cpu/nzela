# Defects (open) — 2026-10-24

Only defects that survived verification. Code-layer defects found this cycle: **none**
(0 `any`/`@ts-ignore`, prod audit clean, 288 tests green, 21/21 adversarial pass).
The open items are truth/fitness + operational, below.

## TA-1 — Voice ordering advertised but not implemented
- Severity P1 · Blocker: Yes (for the voice claim) · Area: truth/fitness, AI
- Expected: "commander à la voix en lingala/français" works (headline blog post + hero).
- Actual: `backend/agents` is interfaces/contracts only (Phase 2); no LLM transcription/extraction path. Deterministic text flow works.
- Root cause: LLM agents deferred; marketing shipped ahead of the capability.
- Fix: build the agent (needs AI keys) OR relabel claim "bientôt". → `human-actions.md` H-5. Status: OPEN (owner decision).

## TA-2 — Public surfaces present a live, open service that is not deployed
- Severity P1 · Blocker: Yes · Area: truth/fitness
- Actual: "On vient d'ouvrir / Commander maintenant" + a +44 CTA, with nothing hosted.
- Fix: launch, OR reframe to waitlist/"bientôt". → H-6. Status: OPEN (owner decision).

## TA-3 — "Mobile money auto-confirmed in ~30 s" depends on un-provisioned hardware
- Severity P2 · Blocker: Yes for that claim · Area: truth/fitness, payments
- Actual: parser/matcher/replay REAL + tested; needs Lipa Box + SIMs to be true end-to-end.
- Fix: provision the box, OR soften wording until live. → H-4. Status: OPEN (operational).

## Non-blocking (documented, not shipped to prod)
- N-1: 17 dev-only dependency advisories (vite/esbuild/vitest dev-server) — absent from the `--prod` image; `pnpm audit --prod` clean. Justified.
- N-2: single-instance file-backed persistence (Redis/Postgres for scale).
- N-3: no monitoring/alerting/log-aggregation wired; no formal a11y/device-matrix audit.
