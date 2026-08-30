# NZELA-OS — Platform Status (single source of truth)

**Purpose:** the authoritative record of what exists, its verified state, and
what remains. Read this BEFORE building anything — do not rebuild what is
listed as done. Update it when status changes. (Operating directive §3, §48.)

**Last verified:** 2026-08-19 — **179 tests passing (26 files)**, typecheck
clean, git tree clean. (Working branch is whatever the current session uses;
do not treat a branch name here as canonical — it goes stale across sessions.)

Legend: ✅ built + tested · 🟡 built, needs live wiring/keys · ⬜ not built ·
📄 document only.

---

## Modules (code)

| Package | Purpose | Status | Tests |
|---|---|---|---|
| `shared/ledger` | Ledger events, 8→11 agent registry + hard budgets, budget middleware, ACU wallet+gating, per-order cost meters, all-in economics (×2 rule), **idempotent money-in funding: ACU top-up + subscription-period grant** | ✅ | 4 files |
| `shared/stackfood-client` | StackFood REST client (retry/timeout), idempotency, TK refs, auth provisioning, idempotent Order Adapter, category registry, in-process integration test | ✅ | 6 files |
| `shared/landmark-graph` | Landmark addressing→StackFood fields, geolocation distance, 5 km gates + rain mode, zone tariffs | ✅ | 2 files |
| `shared/security` | Humanity gate, non-human-instruction firewall, WAF/threat detection, Sentinelle agent (ACU-gated, fail-safe) | ✅ | 1 file |
| `backend/gateway` | HTTP server (Meta webhook verify, inbound→Router, HMAC StackFood hook), Router+AI firewall, status→milestone map, fee récap, customer receipt+leak guard, Cuisine Sync exception ladder, server-authoritative pricing (`pricing.ts`), **conversation dispatch (`dispatch.ts`): every decision now gets a reply — deterministic-first with injected providers + agent fallbacks + InitiateCheckout signal** | ✅ | 7 files |
| `backend/lipa-ingest` | SMS Ledger Bridge: 4-operator parsers, matcher, replay protection, ingest HTTP endpoint. **Money-hardened: no-underpayment asymmetric tolerance; content-fingerprint replay burn (no double-credit even without a txn id)** | ✅ | 4 files |
| `backend/seo-agent` | Dynamic internal-linking engine, SEO metadata (canonical/OG/hreflang/JSON-LD/sitemap), backlink pipeline, autopilot (budget+ACU), **per-post SEO score 0–100 (deterministic, weighted breakdown)** | ✅ | 2 files |
| `backend/growth-engine` | Partner marketing suite — 5 deterministic analytics tools + 5 LLM generators (budget+ACU) | ✅ | 1 file |
| `backend/acquisition` | Referral loop (abuse-proof), funnel analytics, viral k-factor, win-back targeting | ✅ | 1 file |
| `backend/newsletter` | Weekly email to consented users: feature catalog (links to blog), consent+unsubscribe, hyperlink-dense HTML/text composer, idempotent resilient weekly scheduler | ✅ (needs email provider + subscriber DB at deploy) | 1 file |
| `backend/agents` | LLM agent contracts (Commande/Adresse/Litige/Upsell) — interfaces only | 🟡 contracts only; LangGraph impls Phase 2 | 0 |
| `backend/analytics` | Server-side conversion spine: Meta Conversions API + GA4 Measurement Protocol, SHA-256 PII hashing, pixel dedup by shared event_id, fail-safe fan-out; wired into the lipa payment-verified path (Purchase) | ✅ (needs Meta/GA4 tokens at deploy) | 1 file |
| `backend/views` | Blog post view counter: increment/read HTTP endpoint, per-slug store (in-memory port; Redis at deploy), slug validation, CORS, best-effort per-IP de-dup window | ✅ (needs hosting at deploy) | 1 file |

**Agent registry (11):** router, commande, adresse, lipa, cuisine-sync,
wewa-dispatch, litige, mama-upsell, seo, growth, sentinelle. Deterministic
agents fully built; LLM agents (commande/adresse/litige/upsell/seo/growth
generators) have contracts + budget/ACU gating + deterministic fallbacks
but need **LLM API keys wired at deploy** to produce real prose. 🟡

## Frontend surfaces

| Surface | Status |
|---|---|
| `frontend/blog` | ✅ 12 SEO posts, engine-linked, number set (wa.me/447493216101), deploy-ready; **on-page view counter (`views.js` → `@nzela/views`) + build-time `seo-report.json` (per-post SEO score)** |
| `frontend/landing` | ✅ landing + splash, number set, self-contained |
| `frontend/partner-dashboard` | 🟡 working demo UI (demo data mirrors real engine); needs Next.js host + live data — PWA-enabled |
| `frontend/pwa` | ✅ shared PWA kit — brand icons (192/512/maskable/apple-touch/favicon), self-contained splash overlay (`pwa-splash.js`), service worker; **shared analytics kit (`analytics.config.js` + `analytics.js`: Meta Pixel + Google gtag, single config)** wired into landing, partner-dashboard, blog (all pages) + prototype; reuse for ops-console |
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

`TokenCache`, `AcuWallet`, `ReplayIndex`, `RateLimiter`, `PasswordVault`,
`SentLog`, referral code/rewards resolvers (`resolveCode`, `rewardsEarned`,
`CreditIssuer`), gateway `phaseFor`/`tkRefFor`, lipa `openOrders` — all
defined as interfaces with in-memory implementations for tests, and now
**durable file-backed implementations** for single-instance production:
`@nzela/persistence` (`FileKV`, atomic writes) backs `FileAcuWallet` +
`FileFundingLedger` (ledger), `FileReplayIndex` (lipa) and `FileViewStore`
(views) — so verify-once / reward-once / balances / view counts **survive a
restart with no external database** (tested across a simulated restart).
Wire them by passing a file path (e.g. `new FileReplayIndex(dataDir +
"/replay.json")`). A multi-instance / high-concurrency deploy still wants
Redis/Postgres behind the same interfaces (+ a real secrets manager for
`PasswordVault`); no schema migrations written yet. ⬜

## Open decisions (must be closed by the owner — single list)

These are unresolved across the docs; recorded here so they live in one
place instead of scattered. None is code — each needs Justin's call.

| # | Decision | Why it matters | Where flagged |
|---|---|---|---|
| **D-1** | **Customer-facing WhatsApp number: the +44 line (447493216101) already baked into blog/landing/GTM, OR a new local +243 number.** | Gates the manual launch, QR posters, every blog/referral link. Runbooks still carry a `243000000000` placeholder while shipped assets carry +44 — they cannot both be right. **The single most important open decision.** | GO_LIVE_CHECKLIST D-1; GO-TO-MARKET §8/§10 |
| **D-2** | Card payments can't meet the ×2 rule at the reference basket — surcharge the gateway fee, reserve card for diaspora-premium, or drop card at launch. | Decides whether card is offered week 1. | ERRATA E-6; UNIT_ECONOMICS; GTM §7 |
| **D-3** | Merchant SIM numbers (M-Pesa / Orange / Airtel / Africell) to print in the pay instructions. | No mobile-money payment can happen until these exist. | GO_LIVE_CHECKLIST D-4; LIPA_BOX_BUILD |
| **D-4** | KODA Master Spec v2.0 — commit it into the repo or mark KODA_Integration_Notes out-of-scope for launch. | The notes doc references a file not in the repo. | KODA_Integration_Notes |
| **D-5** | Escalation calls: TTS telephony provider, or confirm manual ops calls for the pilot. | Pilot can run manual; only matters at scale. | GO_LIVE_CHECKLIST D-2 |

## Conversation/dispatch layer — BUILT (2026-08-25)

The gateway previously computed a router decision per inbound message but
only *acted* on `firewall-block`, so a normal ordering message got no reply.
`backend/gateway/src/dispatch.ts` closes that: every decision
(deterministic actions, agent escalations, firewall blocks) is now rendered
into a reply and sent. Deterministic-first — restaurants/menu/cart/checkout/
status come from injected providers with safe canned fallbacks, so the order
loop always answers with no LLM keys and no live number. Agent escalations
call the (Phase-2) LLM agent when wired, else degrade to a deterministic
nudge; nothing throws to the loop. A server-side `InitiateCheckout` analytics
signal fires on checkout.

**Still needed at deploy (not code):** the WhatsApp Cloud API `sender`
adapter + live number (D-1), the LLM agents (Phase 2), and the production
data providers (StackFood catalog, session cart, `priceOrder`-built checkout
récap) wired into `GatewayConfig.dispatch`.

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
