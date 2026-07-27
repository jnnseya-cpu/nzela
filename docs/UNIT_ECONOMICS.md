# Unit Economics — All-In Cost Model & the ×2 Rule

**The rule (owner decision, ERRATA E-6):** every order must generate
**100% profit over ALL costs** — Tunakula margin ≥ 2 × all-in cost. Not
just AI and messaging: AI + WhatsApp + payment-rail fees + the
Firebase/GCP stack + numbers/telephony/devices/overhead, amortized per
order. Implemented and tested in `shared/ledger/src/economics.ts`.

Reference basket (§8): 17 000 FC food → customer pays 22 540 FC ($8.05)
→ Tunakula margin **$1.10**.

## Per-order variable costs (worst-case caps + planning rates)

| Cost line | Cash | Mobile money | Card (Stripe-class) |
|---|---|---|---|
| AI (hard cap) | $0.050 | $0.050 | $0.050 |
| WhatsApp templates (cap) | $0.024 | $0.024 | $0.024 |
| Rail fee | $0 (wewa collects) | 1.5% of $8.05 = $0.121 | 3.9% + $0.30 = $0.614 |
| **Variable total** | **$0.074** | **$0.195** | **$0.688** |

## Monthly fixed stack (planning number: $300/month — replace with invoices)

| Line | Est./month |
|---|---|
| GCP/Firebase: Cloud Run + Postgres + Redis + monitoring/egress | $150–220 |
| WhatsApp Business number + TTS telephony reserve | $20–40 |
| Domains/TLS | $5 |
| Lipa Box: 2 phones amortized + 4 SIM data plans | $25–35 |
| **Planning total** | **$300** |

(Human ops salaries for the manual phase are a launch cost, not in the
per-order model — add them to `monthlyFixedUsd` if you want them ruled.)

## What the model says (computed, test-pinned)

1. **Break-even volume for the ×2 rule** (margin/2 must cover variable +
   fixed/N):
   - Cash orders: **631 orders/month (~21/day)**
   - Mobile money: **845 orders/month (~29/day)**
   - Below that volume the order is still profitable before fixed costs,
     but the rule isn't met — fixed costs dominate. At 200 orders/month
     the all-in cost is $1.70/order: **loss-making**. Volume is the whole
     game in month 1–2.
2. **Card orders can NEVER meet the rule at the reference basket** —
   $0.688 variable already exceeds half the $1.10 margin. No volume fixes
   it. Pricing decisions available:
   - keep card on the web checkout and let the 2% processing fee
     under-recover (accept card as a convenience loss-leader), or
   - surcharge card orders the true gateway fee (Stripe cost passed
     through — common and legal in most contexts), or
   - reserve card for the diaspora premium flow where basket sizes and a
     convenience fee restore the math (the Blueprint's intent).
   **Decision needed from Justin.**
3. **The margin engine is fine** — at 1 000 orders/month, a momo order
   is all-in $0.495 against $1.10 margin: $0.60 profit, ~122% over cost,
   rule met. The ceilings protect it: if AI creep ever pushed variable
   cost past $0.55 − rail fee, the rule breaks regardless of volume —
   which is exactly why budgets are hard caps.

## Governance

- `orderPnl()` computes the per-order P&L per rail; wire it into the ops
  console weekly report next to ACDO.
- Update `DEFAULT_COSTS` monthly from real invoices (GCP billing export,
  operator settlement statements, Stripe fees). The model is config.
- Alert when: monthly volume < break-even for the dominant rail, or any
  rail's `meetsRule` is false for >20% of orders.
