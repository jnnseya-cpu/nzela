# KODA ↔ NZELA-OS Integration Notes

**Status:** working notes pending the full *KODA Unified Master
Specification v2.0* document (not yet in this repo — commit it alongside
the other handoff docs when available).

## What KODA is, relative to NZELA-OS

KODA productizes the SMS Ledger Bridge: telco-anchored verification of
mobile-money payments from the merchant-side confirmation SMS, offered to
any merchant. Architecture doctrine: **"Three Doors, One Engine"** — every
merchant uses the identical matching, fraud scoring, replay index and
audit trail; only the interface differs:

| Door | Interface | Notes |
|---|---|---|
| 1 — Manual | Verify Console: paste code / snap screenshot → verdict ~3 s with matched SMS shown | Ships P0; projected ≥70% of early merchants; live payments feed, branded receipts, daily WhatsApp digest, team seats with per-cashier audit |
| 2 — WhatsApp Chat | Verification as a participant in the sales conversation | To be incorporated |
| 3 — API | Full automation, webhooks, sub-merchant platform onboarding | To be incorporated |

One account, one ledger, zero migration — graduation between doors is a
toggle, not a rebuild. One pricing ladder across all doors: a manual
verification and a webhook verification are the same billable atom, same
"free until you get paid" rule, prepaid mobile-money top-up loop.

Coverage doctrine: **Template Packs** — KODA works wherever the operator
sends a merchant-side confirmation SMS (GSMA-model mobile money on every
continent). Six expansion waves starting DRC → Africa core →
bKash/JazzCash → GCash/DANA → EVC Plus/Vodafone Cash → Tigo
Money/MonCash, plus a Community Template Program (merchant submits five
sample SMS; ParserAgent drafts, canaries and ships the pack). App-only
wallets and UPI/PIX are excluded as roadmap adapters.

## How the two systems share code

- **NZELA-OS is a Door 3 consumer.** Tunakula's Lipa Box is the first
  production tenant of the engine: `backend/lipa-ingest` (operator parsers,
  TK-ref matching, replay index) is the engine core; the DRC operator
  regexes are the first Template Pack (M-Pesa, Orange Money, Airtel
  Money, Africell).
- **The engine invariants live here** and must hold for both products:
  regex-first parsing (vision fallback is budgeted), match by reference +
  amount, never force-match a mismatch, replay protection (a reference
  verifies once, then is dead forever), every verdict written to the
  ledger with cost.
- NZELA's ops Registre and KODA's per-cashier audit trail are the same
  event model (`@nzela/ledger`).

## Open items

1. Commit the full KODA Unified Master Specification v2.0 to `docs/`.
2. Door 2 (WhatsApp chat verification) and Door 3 (API/webhooks)
   incorporation plan against the NZELA gateway.
3. Landing page v2 (three-doors section + worldwide map) and the Verify
   Console UI prototype — tracked in the KODA workstream.
