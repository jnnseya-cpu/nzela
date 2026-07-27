# Errata & Product Decisions

Per the Developer Requirements v1.0 closing note, divergences between the
binding documents and reality are recorded here as product decisions rather
than silently editing the handoff documents.

## E-1 · System-of-record host is cd.tunakula.com (2026-07-18)

**Decision (owner: Justin Nseya):** The existing StackFood platform at
**https://cd.tunakula.com** (admin: https://cd.tunakula.com/admin) is and
will remain the main platform. NZELA-OS, the WhatsApp-native channel, reads
and writes everything through its API.

The three handoff documents (Requirements v1.0, Integration Spec v1.0,
Blueprint v1.0) refer to the system of record as `drc.tunakula.com`; read
every such reference as `cd.tunakula.com`. Code uses
`PRODUCTION_BASE_URL` in `@nzela/stackfood-client` as the single source of
truth for the host. The admin category export in `docs/data/Categories.csv`
already originates from cd.tunakula.com.

## E-2 · Home-surface languages (2026-07-18)

**Decision (owner: Justin Nseya):** The entry/home surface is French-first
with English, Arabic, Spanish and Chinese selectable (🌐 pill in the
prototype). Customer chat strings remain French, Kinois register, per
product principle 7; multilingual chat is a later agents-layer decision.

## E-3 · Customer never sees the ops bilan (2026-07-18)

**Decision (owner: Justin Nseya):** End-of-order, the customer receives a
StackFood-style receipt only (order id, date, restaurant, status, payment,
items, fee breakdown, total). The economic bilan (AI spend, margin, wewa
split, coverage) is ops-ledger material — this matches FR-W4 and is
enforced in code by `assertCustomerSafe()` in the gateway.

## E-4 · Restaurant distance from customer geolocation (2026-07-18)

**Decision (owner: Justin Nseya):** The distance to the closest restaurant
is calculated from the customer's geolocation — a live position when
shared (WhatsApp location message, or browser geolocation on the entry
page), else the saved Adresse Vocale centroid. This is the basis for
nearest-restaurant selection, the discovery list ordering (FR-D2), and the
5 km radius gates. FR-R1's landmark-ring hops remain the basis for the
delivery-zone fee classification (§8) and wewa-facing directions (FR-L3).
Implemented in `@nzela/landmark-graph` (`distance.ts`).

## E-5 · Payment methods and repo layout (2026-07-18)

**Decision (owner: Justin Nseya):** Accepted payment methods are cash,
carte bancaire (via the cd.tunakula.com web checkout / StackFood card
gateway), and mobile money on all four operators — M-Pesa, Orange Money,
Airtel Money, Africell Money. In chat, mobile money is one button (the
Lipa Box identifies the operator from the confirmation SMS); carte routes
to the web checkout on the shared account.

The monorepo is organised as `frontend/` · `backend/` · `shared/`
(supersedes the §11 `apps/`+`packages/` naming; package names `@nzela/*`
unchanged).

## E-6 · All-in cost governance — the ×2 rule (2026-07-26)

**Decision (owner: Justin Nseya):** Profitability is governed against the
FULL cost stack, not only AI + messaging: AI, WhatsApp, payment-rail fees
(mobile-money settlement, Stripe/card gateway), and amortized fixed costs
(Firebase/GCP, numbers, telephony, devices, overhead). Target: every
order yields **100% profit over all-in cost** (margin ≥ 2 × all-in).
Model + guard in `shared/ledger/src/economics.ts`; analysis in
`docs/UNIT_ECONOMICS.md`. Open pricing decision: card orders cannot meet
the rule at the reference basket — surcharge, restrict to diaspora
premium, or accept as loss-leader.
