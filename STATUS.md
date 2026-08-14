# NZELA-OS — Platform Status (single source of truth)

**Purpose:** the authoritative record of what exists, its verified state, and
what remains. Read this BEFORE building anything — do not rebuild what is
listed as done. Update it when status changes. (Operating directive §3, §48.)

**Last verified:** 163 tests passing (24 files), typecheck clean, git tree
clean. Branch `claude/new-session-yygh5a`.

Legend: ✅ built + tested · 🟡 built, needs live wiring/keys · ⬜ not built ·
📄 document only.

---

## Modules (code)

| Package | Purpose | Status | Tests |
|---|---|---|---|
| `shared/ledger` | Ledger events, 8→11 agent registry + hard budgets, budget middleware, ACU wallet+gating, per-order cost meters, all-in economics (×2 rule) | ✅ | 3 files |
| `shared/stackfood-client` | StackFood REST client (retry/timeout), idempotency, TK refs, auth provisioning, idempotent Order Adapter, category registry, in-process integration test | ✅ | 6 files |
| `shared/landmark-graph` | Landmark addressing→StackFood fields, geolocation distance, 5 km gates + rain mode, zone tariffs | ✅ | 2 files |
| `shared/security` | Humanity gate, non-human-instruction firewall, WAF/threat detection, Sentinelle agent (ACU-gated, fail-safe) | ✅ | 1 file |
| `backend/gateway` | HTTP server (Meta webhook verify, inbound→Router, HMAC StackFood hook), Router+AI firewall, status→milestone map, fee récap, customer receipt+leak guard, Cuisine Sync exception ladder | ✅ | 5 files |
| `backend/lipa-ingest` | SMS Ledger Bridge: 4-operator parsers, matcher, replay protection, ingest HTTP endpoint | ✅ | 4 files |
| `backend/seo-agent` | Dynamic internal-linking engine, SEO metadata (canonical/OG/hreflang/JSON-LD/sitemap), backlink pipeline, autopilot (budget+ACU) | ✅ | 1 file |
| `backend/growth-engine` | Partner marketing suite — 5 deterministic analytics tools + 5 LLM generators (budget+ACU) | ✅ | 1 file |
| `backend/acquisition` | Referral loop (abuse-proof), funnel analytics, viral k-factor, win-back targeting | ✅ | 1 file |
| `backend/agents` | LLM agent contracts (Commande/Adresse/Litige/Upsell) — interfaces only | 🟡 contracts only; LangGraph impls Phase 2 | 0 |

**Agent registry (11):** router, commande, adresse, lipa, cuisine-sync,
wewa-dispatch, litige, mama-upsell, seo, growth, sentinelle. Deterministic
agents fully built; LLM agents (commande/adresse/litige/upsell/seo/growth
generators) have contracts + budget/ACU gating + deterministic fallbacks
but need **LLM API keys wired at deploy** to produce real prose. 🟡

## Frontend surfaces

| Surface | Status |
|---|---|
| `frontend/blog` | ✅ 12 SEO posts, engine-linked, number set (wa.me/447493216101), deploy-ready |
| `frontend/landing` | ✅ landing + splash, number set, self-contained |
| `frontend/partner-dashboard` | 🟡 working demo UI (demo data mirrors real engine); needs Next.js host + live data |
| `frontend/ops-console` | ⬜ placeholder README only; Next.js app not scaffolded |
| `docs/prototype` | ✅ interactive 4-screen prototype (UX contract) |

## What is NOT built / NOT live (do not claim otherwise)

- ⬜ **Nothing is deployed.** No running server, no hosting, no live URL.
- ⬜ **No live WhatsApp Cloud API** (Meta verification + templates pending).
- ⬜ **No live cd.tunakula.com wiring** (needs service tokens + Postman diff).
- ⬜ **Lipa Box hardware** not commissioned (endpoint code ✅, phones/SIMs ⬜).
- ⬜ **No Postgres/Redis/Kafka** — persistence is via injected interfaces
  (in-memory impls in code); real stores wired at deploy.
- ⬜ **No real customer, no real payment tested end-to-end** (integration
  test uses an in-process mock, not the real backend).
- 🟡 LLM agents need API keys; SEO/Growth generators need keys + a host.

## Persistence contracts (interfaces awaiting real backends)

`TokenCache`, `AcuWallet`, `ReplayIndex`, `RateLimiter`, referral
code/rewards resolvers, open-orders lookup — all defined as interfaces with
in-memory implementations for tests. Production wires Redis/Postgres behind
the same interfaces. (No schema migrations written yet. ⬜)

## Key documents (`docs/`)

Requirements v1.0, StackFood Integration Spec, Blueprint (the 3 handoff
docs) · ERRATA (E-1..E-8 product decisions) · SATURDAY_LAUNCH_RUNBOOK ·
LAUNCH_TOMORROW · GO_LIVE_CHECKLIST · GO_LIVE_READINESS · CUSTOMER_ACQUISITION ·
UNIT_ECONOMICS · ACU_METERING · SECURITY_HUMANS_ONLY · STACKFOOD_API_ACCESS ·
LIPA_BOX_BUILD · KODA_Integration_Notes · sales/ (dossier + competitive
analysis, Word).

## The critical path to a real customer (unchanged, human-gated)

1. Live WhatsApp number + operator (manual channel) — see SATURDAY_LAUNCH_RUNBOOK
2. 3–5 signed restaurants + wewas
3. cd.tunakula.com service tokens + one real test order
4. One real mobile-money payment verified end-to-end
5. Then: deploy the gateway/lipa services; then the LLM agents replace the operator.

**None of 1–4 are code.** The code is done and tested; launch is gated on
these operational steps.

---
*Update this file whenever a status changes. It is the platform memory.*
