# NZELA-OS — STATUS (single source of truth)

**One place. Read this before asking for anything new, so we don't rebuild
what exists.** Verified against the repo, not memory: 30 commits, **163
tests passing**, tree clean.

Status legend:
- ✅ **DONE** — code written, tested, committed.
- 🎨 **UI-ONLY** — HTML/prototype exists; not wired to live backend.
- 📄 **DOC** — a document/plan, not running software.
- ⛔ **NOT DONE** — needs external input or deploy; cannot be finished in-repo.

---

## Backend libraries (TypeScript, tested — NOT deployed)

| Component | What it is | Status |
|---|---|---|
| `shared/ledger` | 11-agent registry, budget middleware, **ACU gating** (no free AI), cost meters, **×2 all-in economics** | ✅ DONE |
| `shared/stackfood-client` | StackFood REST client, auth provisioning, idempotent Order Adapter, category registry, retry contract | ✅ DONE |
| `shared/landmark-graph` | Landmark addressing, **geolocation distance**, 5 km gates, rain mode, zone tariffs | ✅ DONE |
| `shared/security` | **Humanity gate, instruction firewall, WAF, Sentinelle anti-hacking agent #11** | ✅ DONE |
| `backend/gateway` | Router + AI firewall, receipt, exception ladder, webhook HMAC, **HTTP server** | ✅ DONE |
| `backend/lipa-ingest` | SMS parsers (4 operators), payment matcher, replay protection, **ingest endpoint** | ✅ DONE |
| `backend/seo-agent` | SEO agent #9: dynamic internal linking, metadata/schema/sitemap | ✅ DONE |
| `backend/growth-engine` | Growth agent #10: 5 generators + 5 analytics tools | ✅ DONE |
| `backend/acquisition` | Referral loop, funnel analytics, win-back | ✅ DONE |
| `backend/agents` | LLM agent contracts (Commande/Adresse/Litige/Upsell) — interfaces only | ⛔ impl needs LLM keys |

## Frontend (static — NOT hosted)

| Component | Status |
|---|---|
| `frontend/landing` (landing + splash) | 🎨 UI-ONLY — needs real wa.me number + hosting |
| `frontend/blog` (12 SEO posts, sitemap) | 🎨 UI-ONLY — deploy-ready; needs number + hosting |
| `frontend/partner-dashboard` | 🎨 UI-ONLY — demo data, not wired to `growth-engine` |
| `frontend/ops-console` | 📄 README only — Next.js app not scaffolded |
| `docs/prototype` (interactive 4-screen demo) | 🎨 UI-ONLY — the UX contract, shareable artifact |

## Documents

Requirements/Spec/Blueprint (handoff), `ERRATA.md` (E-1…E-8 decisions),
`UNIT_ECONOMICS.md`, `ACU_METERING.md`, `SECURITY_HUMANS_ONLY.md`,
`CUSTOMER_ACQUISITION.md`, launch docs (`SATURDAY_LAUNCH_RUNBOOK.md`,
`LAUNCH_TOMORROW.md`, `GO_LIVE_CHECKLIST.md`, `GO_LIVE_READINESS.md`),
`LIPA_BOX_BUILD.md`, `STACKFOOD_API_ACCESS.md`, `KODA_Integration_Notes.md`,
sales `docs/sales/*.docx`. → 📄 DOC

---

## The honest bottom line

**Everything above is a tested library or a static file. NOTHING is
deployed or connected to anything live.** That is why there are zero
customers — not a missing feature.

### The ONLY things that produce a real customer (none are code)
1. ⛔ A **live WhatsApp number** people can message.
2. ⛔ **3–5 signed restaurants + wewas** in Bandal.
3. ⛔ At least **cash + one mobile-money path** proven with real money.
4. ⛔ The landing/blog **hosted** with the real number.

Path: `docs/SATURDAY_LAUNCH_RUNBOOK.md` (manual channel — no deploy needed).

### Inputs still owed by Justin (block the automated system, not launch)
- Real WhatsApp number (finalizes landing + blog in one command).
- One real confirmation SMS per operator (pins the Lipa parsers).
- Merchant SIM numbers; hosting/GCP access; Meta Business verification.

---

## Working agreement (to stop the repetition)
1. This file is the source of truth. New requests are checked against it
   first — if it exists, we don't rebuild it.
2. No new feature until launch inputs above are unblocked, unless it
   directly serves Saturday.
3. Every change keeps `pnpm verify` green (163 tests today).
