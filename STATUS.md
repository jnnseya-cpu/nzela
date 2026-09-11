# NZELA-OS — Platform Status (single source of truth)

**Purpose:** the authoritative record of what exists, its verified state, and
what remains. Read this BEFORE building anything — do not rebuild what is
listed as done. Update it when status changes. (Operating directive §3, §48.)

**Last verified:** 2026-09-10 — **279 tests passing (42 files)**, typecheck
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
| `backend/gateway` | HTTP server (Meta webhook verify, inbound→Router, HMAC StackFood hook, **inbound X-Hub-Signature-256 verification on the raw body when `waAppSecret` set — forged inbound messages rejected**), Router+AI firewall, status→milestone map, fee récap, customer receipt+leak guard, Cuisine Sync exception ladder, server-authoritative pricing (`pricing.ts`), conversation dispatch (`dispatch.ts`), **real WhatsApp Cloud API sender (`wa-sender.ts`: `CloudApiSender` → graph.facebook.com, `ConsoleSender` fallback — the outbound front door)** | ✅ | 9 files |
| `backend/lipa-ingest` | SMS Ledger Bridge: 4-operator parsers, matcher, replay protection, ingest HTTP endpoint. **Money-hardened: no-underpayment asymmetric tolerance; content-fingerprint replay burn (no double-credit even without a txn id)** | ✅ | 4 files |
| `backend/seo-agent` | Dynamic internal-linking engine, SEO metadata (canonical/OG/hreflang/JSON-LD/sitemap), backlink pipeline, autopilot (budget+ACU), per-post SEO score 0–100, **+ AEO/GEO layer (`aeo.ts`): answer-engine score 0–100 + FAQPage / BreadcrumbList / Speakable / Organization+WebSite / enriched Article schema + `llms.txt` (`metadata.ts`) — built to be lifted & cited by ChatGPT/Perplexity/Google AI Overviews, voice & social search** | ✅ | 3 files |
| `backend/growth-engine` | Partner marketing suite — 5 deterministic analytics tools + 5 LLM generators (budget+ACU) | ✅ | 1 file |
| `backend/acquisition` | Referral loop (abuse-proof), funnel analytics, viral k-factor, win-back targeting, **real `StackFoodCreditIssuer` (`credit.ts`): pays referral rewards into the StackFood wallet via `admin/customer/wallet/add-fund` — refuses non-positive credit + unresolved customer, ledgered** | ✅ | 2 files |
| `backend/newsletter` | Weekly email to consented users: feature catalog (links to blog), consent+unsubscribe, hyperlink-dense HTML/text composer, idempotent resilient weekly scheduler | ✅ (needs email provider + subscriber DB at deploy) | 1 file |
| `backend/agents` | LLM agent contracts (Commande/Adresse/Litige/Upsell) — interfaces only | 🟡 contracts only; LangGraph impls Phase 2 | 0 |
| `backend/analytics` | Server-side conversion spine: Meta Conversions API + GA4 Measurement Protocol, SHA-256 PII hashing, pixel dedup by shared event_id, fail-safe fan-out; wired into the lipa payment-verified path (Purchase) | ✅ (needs Meta/GA4 tokens at deploy) | 1 file |
| `backend/views` | Blog post view counter: increment/read HTTP endpoint, per-slug store (in-memory port; Redis at deploy), slug validation, CORS, best-effort per-IP de-dup window | ✅ (needs hosting at deploy) | 1 file |
| `backend/server` | **Production bootstrap — composes the whole OS into two runnable services.** `configFromEnv` (single env contract) + `buildServices` (pure factory: injectable fetch/ledger/sender) wire StackFoodClient + auth (FileTokenCache) + OrderAdapter + ConversationEngine into the gateway, the SMS Ledger Bridge into lipa, joined by a durable **OpenOrderBook** (placed→paid reconciliation). `onVerified` fans out to analytics (Purchase) + notifies the customer on WhatsApp. `main.ts` reads env, prints launch-readiness, binds ports. End-to-end tested (conversation → order → SMS payment → "paiement reçu"). | ✅ (needs credentials at deploy) | 1 file |

**Agent registry (11):** router, commande, adresse, lipa, cuisine-sync,
wewa-dispatch, litige, mama-upsell, seo, growth, sentinelle. Deterministic
agents fully built; LLM agents (commande/adresse/litige/upsell/seo/growth
generators) have contracts + budget/ACU gating + deterministic fallbacks
but need **LLM API keys wired at deploy** to produce real prose. 🟡

## Frontend surfaces

| Surface | Status |
|---|---|
| `frontend/blog` | ✅ 12 posts, premium editorial redesign, engine-linked (**72 dynamic internal links, 6/post, zero orphans**); **AEO/GEO-grade: answer-first "L'essentiel" block + visible FAQ + FAQPage/Breadcrumb/Speakable/Article JSON-LD + absolute canonical/OG + `llms.txt`**; build-time quality **gate: every post ≥90 on BOTH SEO and AEO — currently 100/100 avg on both** (`seo-report.json`); on-page view counter (`views.js` → `@nzela/views`) |
| `frontend/landing` | ✅ **premium rebuild + conversion pass** — WhatsApp phone mockup, custom SVG icons, editorial rhythm, real dishes, FAQ. Conversion fixes: trust-first "Zéro risque" section (cash-at-door / hot / 40s refund) replacing the technical-vanity block; **fake testimonials removed** → honest "100 premiers" founding offer + livraison-offerte; dedicated restaurant **0% commission** money-math; hero stats reframed to benefits; engineering story relocated to `/tech.html`. `+243` number is the one open item (flagged in-file). |
| `frontend/partner-dashboard` | 🟡 working demo UI (demo data mirrors real engine); **premium SaaS restyle (brand system, SVG icons)**; needs Next.js host + live data — PWA-enabled |
| `frontend/pwa` | ✅ shared PWA kit — brand icons (192/512/maskable/apple-touch/favicon), self-contained splash overlay (`pwa-splash.js`), service worker; **shared analytics kit (`analytics.config.js` + `analytics.js`: Meta Pixel + Google gtag, single config)** wired into landing, partner-dashboard, blog (all pages) + prototype; reuse for ops-console |
| `frontend/ops-console` | ⬜ placeholder README only; Next.js app not scaffolded |
| `docs/prototype` | ✅ interactive 4-screen prototype (UX contract), aligned to the brand system |
| **unified deploy** | ✅ `frontend/build.mjs` (`pnpm build:site`) assembles one static site — `/` landing · `/blog` + posts · `/pro` dashboard · `/pwa` kit — with absolute asset paths + host configs (Netlify/Cloudflare `netlify.toml`+`_redirects`, `vercel.json`, Apache/cPanel `.htaccess`), unified sitemap/robots/404. All routes verified over HTTP (0 asset errors). See `frontend/DEPLOY.md`. `frontend/dist` is git-ignored (build artifact). |

## What is NOT built / NOT live (do not claim otherwise)

- ⬜ **Nothing is deployed/hosted.** The service now boots and runs locally
  as one system (`backend/server`), but it is not hosted anywhere — no
  public URL, no process running in prod.
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
`FileFundingLedger` (ledger), `FileReplayIndex` (lipa), `FileViewStore`
(views), `FileSessionStore` (conversation), **`FileTokenCache` (StackFood
auth — no re-login storm after a restart)** and **`OpenOrderBook`
(placed→paid join) + a durable TK-ref sequence** in `backend/server` — so
verify-once / reward-once / balances / view counts / open orders / sessions
**survive a restart with no external database** (tested across a simulated
restart).
Wire them by passing a file path (e.g. `new FileReplayIndex(dataDir +
"/replay.json")`). **At-rest encryption:** every FileKV-backed store takes an
optional 32-byte key — the token, session (address/phone PII), open-order,
replay, and ledger stores encrypt on disk with **AES-256-GCM** (authenticated:
tamper is detected) when `DATA_ENCRYPTION_KEY` is set; a wrong key fails loudly
(never wipes), and turning it on migrates legacy plaintext files on next write.
A multi-instance / high-concurrency deploy still wants Redis/Postgres behind
the same interfaces (+ a real secrets manager for `PasswordVault` and the
encryption key); no schema migrations written yet. ⬜

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

## Conversation engine — BUILT & INTEGRATION-TESTED (2026-08-30)

The full stateful ordering loop is real, not a stub:

- `backend/gateway/src/session.ts` — per-customer session (phase, selected
  restaurant, cart, address), durable via `FileSessionStore` or in-memory.
- `backend/gateway/src/conversation.ts` — `ConversationEngine`: the order
  state machine driving restaurants → menu → cart → address →
  authoritative-priced checkout → idempotent placement, with reset/firewall/
  status handling. Deterministic; catalog + order ports injected.
- `backend/gateway/src/conversation-stackfood.ts` — the REAL ports:
  `buildStackFoodCatalog` (getRestaurants/getLatestProducts) and
  `buildStackFoodOrderPort` (authoritative `priceOrder` → `OrderAdapter`
  idempotent placement, customer token via `CustomerAuthProvisioner`).
- Wired into the server: when `GatewayConfig.conversation` is set it drives
  every inbound message; the stateless router+dispatch remains the fallback.
- **Integration-tested end-to-end** (`conversation-integration.test.ts`):
  the real engine + real client/adapter/pricing/auth place a
  correctly-priced order against an in-process StackFood server, and do not
  double-place. This same code hits the live API unchanged.

**The runnable service now exists:** `backend/server` (`buildServices` +
`main.ts`) composes the conversation engine, the real WhatsApp Cloud API
sender, the StackFood ports, analytics and the SMS Ledger Bridge into two
HTTP services that boot from `.env` (see `.env.example`). `pnpm start` runs
them; both bind and report healthy.

**Turnkey deploy (2026-09-11):** `Dockerfile` (backend services, runs the
tested `node --import tsx …/main.ts` CMD — validated), `Dockerfile.web` +
`frontend/nginx.conf` (static site), `docker-compose.yml` (whole stack in one
command with a durable data volume), portable build scripts (no hardcoded
paths — builds anywhere), CI extended to build the site + both images, and
`docs/DEPLOY_RUNBOOK.md`. Note: Docker **images could not be built in the
sandbox** (registry egress blocked) — the container's exact runtime CMD and
the site build were validated directly instead; the image builds run in
GitHub CI. The full loop — WhatsApp order →
StackFood placement → SMS payment verify → "paiement reçu" — is
integration-tested with mocked transport.

**Still needed to go live (not code — credentials/network):** a live +243
number + WhatsApp Cloud API token/phone-number-id/app-secret (D-1), the
StackFood webhook secret + (for referral credits) an admin token, merchant
mobile-money numbers, and running where the code can reach `cd.tunakula.com`.
LLM voice agents remain Phase 2 (the deterministic numbered-list flow works
without them).

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
