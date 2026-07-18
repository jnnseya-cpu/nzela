# NZELA-OS

**The WhatsApp-native, agentic AI ordering & delivery operating system for
Kinshasa** — Groupe JNN · Tunakula-Congo.

NZELA-OS adds a conversational channel on top of the existing StackFood
platform at **drc.tunakula.com**, which remains the single system of record
for restaurants, menus, prices, orders, and settlement. The design premise:
Uber Eats-style apps fail in Kinshasa because they assume app installs, GPS
addresses, card payments, and cheap data. NZELA-OS assumes the opposite —
WhatsApp is already installed, addresses are landmarks, payment is cash or
mobile-money SMS, and wewas navigate by quartier knowledge.

The system is a **deterministic spine with an AI escalation ladder**: every
step that can be a button, a state machine, or an algorithm costs zero
tokens; LLM agents fire only where natural language genuinely adds value,
each behind a hard per-call budget. Target: **≤ $0.05 AI cost per order**
against **~$1.10 per-order margin**.

## Documents

| Document | Role |
|---|---|
| [`docs/NZELAOS_Developer_Requirements_v1.0.md`](docs/NZELAOS_Developer_Requirements_v1.0.md) | Binding requirements (FR-xx referenced throughout the code) |
| [`docs/NZELA_StackFood_Integration_Spec.md`](docs/NZELA_StackFood_Integration_Spec.md) | StackFood API contract — Flows 1–5 |
| [`docs/TUNAKULA_NZELAOS_Blueprint.md`](docs/TUNAKULA_NZELAOS_Blueprint.md) | Strategy blueprint (thesis, inventions, economics) |
| [`docs/prototype/tunakula-nzela-os-interactive.html`](docs/prototype/tunakula-nzela-os-interactive.html) | **The UX contract** — interactive 4-screen prototype (v1.1, with real category export, cinema mode, resto-injoignable exception path) |

Where code and prototype diverge, flag for product decision — do not assume.

## Monorepo layout

```
apps/
  gateway/         WhatsApp webhook + NZELA Router + AI firewall,
                   status→milestone config mapping (FR-S3), fee récap (§8),
                   Cuisine Sync exception ladder (FR-K1..K3), webhook HMAC
  agents/          LLM agent contracts (Commande, Adresse, Litige, Upsell) —
                   LangGraph implementations land in Phase 2
  lipa-ingest/     SMS Ledger Bridge: operator regex parsers + TK-ref
                   payment↔order matcher (FR-P1/P4)
  ops-console/     Next.js ops console + StackFood-mirrored entry surface
                   (placeholder — Phase 1)
packages/
  ledger/          Ledger events, 8-agent registry with hard budgets (§5),
                   budget middleware (FR-A1), per-order cost meters (FR-M4)
  stackfood-client/ Typed StackFood v1 REST client: retry/timeout contract,
                   idempotency keys (FR-O4), TK refs, Flows 1/3/4/5 calls
  landmark-graph/  Landmark addressing (FR-L1..L4), 5 km radius gates with
                   rain mode (FR-R1..R5), delivery zone tariffs (§8)
```

## Getting started

```bash
pnpm install
pnpm typecheck   # strict TS across all packages
pnpm test        # vitest — specs are pinned to the requirements doc numbers
```

The packages are plain TypeScript with zero runtime dependencies so far;
NestJS wiring (gateway HTTP surface), Postgres/Redis/Kafka infrastructure,
and the LangGraph agents arrive per the delivery plan (§12).

## Non-negotiables encoded in this repo

1. **StackFood is the system of record** — the client package reads, writes
   and mirrors; nothing canonical is stored here.
2. **Deterministic first** — the Router classifies every inbound message
   before any LLM sees it; off-topic content is firewalled at zero tokens.
3. **Budgets are hard caps** — `BudgetMiddleware` meters real spend and
   degrades to buttons, never to failure.
4. **Every AI action is ledgered** — agent, purpose, cost, order ref.
5. **The 5 km rule is inviolable** — one gate implementation, three call
   sites (discovery, placement, dispatch), rain mode shrinks to 3 km.
6. **Client-pays economics, locked** — the §8 reference basket
   (17 000 FC → 22 540 FC total, 3 090 FC margin) is a unit test.

## Delivery status

- [x] Phase 0 (partial): repo scaffold, ledger schema + budget middleware,
      Router + AI firewall, StackFood client contract, status mapping,
      radius gates, SMS parsers, kitchen exception state machine — all
      under test
- [ ] Phase 0: WhatsApp Cloud API onboarding, six Meta template submissions
      (FR-M3), auth provisioning against staging
- [ ] Phase 1: Flows 1 & 3 end-to-end on staging, restaurant channel, wewa
      dispatch, ops console bootstrap
- [ ] Phase 2: Lipa Box hardware ingest, Commande/Adresse agents
      (LangGraph), TTS escalation calls, Mama Upsell, Litige
- [ ] Phase 3: outbox resilience drills, cost alerting, native-speaker
      string review, Bandal soft launch
