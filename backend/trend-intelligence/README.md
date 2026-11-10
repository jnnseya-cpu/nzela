# @nzela/trend-intelligence

Trend / Growth Intelligence **embedded in NZELA-OS** (build spec v2.3). This is
the control layer that reads first-party demand, scores opportunities, issues a
versioned **Growth Brief**, and steers the existing SEO and growth agents — it
lives inside the platform and is fed by the live order/payment paths, not as a
separate product.

## How it's embedded
- **`backend/server`** constructs a `TrendCoordinator(NZELA_PROFILE)` and feeds
  it from the running services: every **order placed** (demand) and every
  **verified payment** (conversion) is recorded as a first-party signal. Boot
  logs `📈 Trend Intelligence embedded`.
- The coordinator scores topics deterministically and emits a validated Growth
  Brief; `briefToSeoDirective` / `briefToMarketingDirective` turn it into the
  target keyword + approved-claim guard-rails the existing **SEO autopilot** and
  **growth engine** consume (spec §1/§4 — the brief changes their priorities and
  approved claims at run time; their roles/permissions stay authoritative).

## Modules
| Module | Spec | Role |
|---|---|---|
| `brief.ts` | §6, App. A, §507 | Growth Brief v1 closed-object validator + window/channel rules |
| `scoring.ts` | §5, §17 | log-lift, robust-z, count gate, opportunity (25/25/20/15/15), confidence (35/25/20/20, single-family cap 69), decision bands |
| `corroboration.ts` | §3, §17 | independent source-family counting (syndication collapse), cluster separation |
| `state.ts` | §6, §18 | opportunity/action state machines, self-approval guard, execution re-auth |
| `action.ts` | §18 | typed action firewall (privileged action structurally impossible) |
| `sdk.ts` | §4, §14 | effective-brief resolver (≤60s cache, never past expiry, cache never authorises writes) |
| **`nzela-profile.ts`** | §9, §16 | the NZELA (Tunakula) host Platform Profile — the ONLY place brand specifics live |
| **`signals.ts`** | §3 | NZELA first-party event → trend observation adapters |
| **`coordinator.ts`** | §5, §6 | ingest signals → score → emit validated Growth Brief (ledger-audited) |
| **`apply.ts`** | §1, §4 | Growth Brief → SEO & growth-engine directives (scoped claim-text resolution) |

**Tests (49):** core math + contract + conformance (TI-03/04/05/06/14/17) and
the NZELA embedding (signals → brief → agent directives; single-family cap;
forbidden-topic veto).

## What is NOT built here (honest, env-gated)
The spec's full product also needs a services/infra layer that **cannot be run
or verified in this sandbox** (no Postgres, no GPU, Docker registry egress
blocked), so it is deliberately out of scope rather than shipped unverified:
FastAPI API + OpenAPI, PostgreSQL + row-level security, the inference gateway
(host-AI / local Qwen3-8B + BGE-M3), external CMS adapters, the React console,
Helm/entitlements, and therefore the §20 keyless release gate and the
DB/CMS-bound TI scenarios. The deterministic control loop that steers NZELA's
own SEO/growth agents and native surfaces is what runs today.
