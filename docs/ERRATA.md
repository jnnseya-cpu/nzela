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
