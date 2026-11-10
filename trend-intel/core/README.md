# @trendintel/core

Deterministic TypeScript core for the **Trend / Growth Intelligence** product
(build spec v2.3). Brand-neutral and industry-neutral by design — no platform
slug, market, locale or taxonomy is baked into core logic (spec portability
rule §14). This package is standalone; it does **not** import or modify any
`@nzela/*` code. NZELA-OS would be a *host/tenant*, not the engine.

## What IS built here (runnable + tested — 44 tests)
| Module | Spec | Covers |
|---|---|---|
| `brief.ts` | §6, Appendix A, §507 | Growth Brief v1 **closed-object validator** (rejects unknown fields, range/pattern checks) + runtime window & channel-membership rules |
| `scoring.ts` | §5, §17 | `logLift`, robust `z` (0.2 floor), count-feed gate (c≥20, z≥2, <4-period insufficiency), opportunity score (25/25/20/15/15), confidence (35/25/20/20, single-family cap 69), decision bands |
| `corroboration.ts` | §3, §17 | independent-source-family counting with **syndication collapse**; cluster-separation key (intent·market·category) |
| `state.ts` | §6, §18 | opportunity + action **state machines** (deterministic router), self-approval guard, execution re-authorisation with typed deny reasons |
| `action.ts` | §6, §18 | **typed proposed-action firewall** — closed schema + field allowlist makes a privileged action structurally impossible (TI-06) |
| `sdk.ts` | §4, §14 | effective-brief resolver: ≤60 s cache ceiling, never past expiry, baseline fallback, `assertWritable` that never trusts the cache |
| `fixtures.ts` | §6, §16 | canonical Growth Brief + profile fixtures |

**Conformance (§21) proven deterministically:** TI-03 (86.25/83.5 unrounded →
reviewable), TI-04 (syndication + stale → one family → no activation), TI-05
(expired cached brief → baseline + executor denies), TI-06 (malicious model
output rejected), TI-14 (separate cluster + intent veto), TI-17 (two dissimilar
profiles, zero platform-name branching).

## What is NOT built here (and why)
This is the **deterministic core only**. The spec's full product also needs a
services/infrastructure layer that **cannot be run or verified in this
sandbox** (no Postgres, no GPU, Docker registry egress blocked), so it is
deliberately out of scope rather than shipped unverified:

- `services/api` — FastAPI/HTTP surface for §16 endpoints, OpenAPI at
  `/openapi.json`, auth/scope resolution, idempotency, quotas.
- `services/worker` — feed ingestion/normalisation, outbox, job leases,
  reconciliation, inference client.
- **PostgreSQL + row-level security** (§15) — tenant isolation, composite FKs,
  RLS, migrations; the TI-01/02/07/08/09/13/15 scenarios need it.
- **Inference gateway** (host-AI adapter / local Qwen3-8B + BGE-M3) — §2/§14.
- **CMS adapters + native owned-surface** renderer (§18) and measurement.
- **React console**, Helm/OCI packaging, entitlements/metering (§19).

The hard keyless release gate (§20) and the DB/CMS/inference conformance
scenarios require that layer and a real environment. Nothing here is reported
as satisfying those gates.

## Run
```
pnpm --filter @trendintel/core exec true   # (workspace member)
npx vitest run trend-intel/core/src        # 44 tests
pnpm typecheck                             # whole repo, strict
```
