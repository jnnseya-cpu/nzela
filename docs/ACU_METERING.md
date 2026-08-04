# ACU Metering & Gating — no free AI action

**Invariant (owner decision, ERRATA E-7):** every AI action is metered and
gated by available ACUs. No LLM/STT/TTS call runs unless its cost is
pre-authorized against an ACU balance; if the balance can't cover it, the
call is **refused** and degrades to the deterministic fallback.
Deterministic steps (buttons, rules, analytics, link graphs) cost 0 ACU
and never touch the wallet — only metered AI does.

## How it works (`shared/ledger/src/acu.ts` + `budget.ts`)

1. **Reserve before run.** On every `BudgetMiddleware.run()` for an AI
   agent, the call's *maximum* cost (`usdToAcu(perCallCap, agent)`) is
   reserved from the billed account.
2. **Refuse when short.** If the balance can't cover the reservation, an
   `acu-gated` ledger event is written and the fallback runs — the LLM
   never fires. This is the "no free AI, regardless" guarantee.
3. **Debit actual after.** On success, real ACUs (`usdToAcu(actualCost)`)
   are committed and the unused hold released. On provider failure or
   overspend, the whole hold is released (nothing charged).

## Pricing & the 3× resale law

- `USD_PER_ACU = 0.001` → 1 ACU = $0.001. A $0.05 call = 50 ACU.
- **Resale multiplier ×3** applies to partner/third-party-billed agents
  (`seo`, `growth`); internal order-path agents (`commande`, `adresse`,
  `lipa`, `cuisine-sync`, `litige`, `mama-upsell`) run at 1×.
- All config, not law — change the rate/multiplier without touching the
  gate logic.

## Wiring

`new BudgetMiddleware(ledger, { wallet, defaultAccount })` turns gating
on. `GrowthEngine` and `SeoAutopilot` accept an optional `AcuGating` and
bill partner generators to the partner's account (`ctx.account`), so a
restaurant that runs out of ACUs simply gets the deterministic template
until it tops up — the platform never eats un-billed AI cost.

Every wallet is a pluggable `AcuWallet` (Postgres/Redis-backed in prod,
in-memory for tests) with atomic reserve/commit/release.

## Reporting

Each AI event carries `meta: { acu, account }`, so per-account ACU
consumption sums straight out of the ledger for billing and for the ops
console meter — alongside the USD cost and the ×2 profit rule.

Tested: 12 cases — conversion, multiplier, reserve/commit/release, debit
on success, refusal when short, partner-account exhaustion at 3×, hold
release on provider failure, and unchanged behaviour when no wallet is set.
