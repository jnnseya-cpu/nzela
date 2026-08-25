# Money-Path Security Audit (2026-08-25)

A deep adversarial review of the entire finance model — payments, ACU
top-up/metering, referral credits, and the refund ladder — to close every
gap, leak, or loophole a user could exploit to make us financially worse
off. Ground truth after this pass: **210 tests, typecheck clean.**

## The finance model (what actually exists)

1. **Payments** — mobile money (M-Pesa / Orange / Airtel / Africell) via the
   **SMS Ledger Bridge** (`backend/lipa-ingest`), plus cash (wewa collects)
   and card (diaspora). No operator API: payment confirmation SMS are parsed,
   matched to an open order, and burned so a code verifies once.
2. **ACU top-up & metering** (`shared/ledger`) — AI compute is pre-paid;
   every AI call reserves ACU, runs, commits actual spend. No free AI.
3. **Crédit Tunakula** — referral rewards (`backend/acquisition`) and
   failure refunds (`backend/gateway` cuisine-sync). Wallet credit, not cash.
4. **No subscription/billing module exists yet** — when one is built, the
   controls in §"Deploy requirements" below must be applied to it.

---

## Fixed this pass (each with a regression test)

| # | Loophole | Impact | Fix |
|---|---|---|---|
| **M1** | **Underpayment tolerance.** Matcher accepted `\|due − paid\| ≤ 100 FC` **symmetrically** — every customer could pay up to 100 FC short and still settle. | Guaranteed per-order loss, at scale a systematic leak. | Tolerance is now **asymmetric** (`MatchTolerance`): default `underpayFc: 0` (no underpayment ever auto-settles → escalates to ops), `overpayFc: 100` (overpay costs us nothing). `matcher.ts`. |
| **M2** | **Replay / double-credit without a txn id.** Replay protection burned only the TK ref + operator `transactionId`. A confirmation with **no** parseable txn id (or a forwarded screenshot) could be replayed to settle several same-amount orders. | One real payment → many settled orders. | Every parsed SMS now carries a **content fingerprint** (`dedupHash = sha256(operator+body)`), which replay burns and checks. The identical forwarded SMS can never verify twice, txn-id or not; genuinely distinct payments differ in body so are unaffected. `parsers.ts`, `replay.ts`. |
| **M3** | **ACU top-up accepted junk.** `topUp` wrote any value — negative, fractional, `NaN`, `Infinity` — corrupting the balance (and `NaN` defeats every later comparison). | Balance corruption / free ACU / broken gating. | `topUp` now requires a **positive integer**, else `RangeError`. `acu.ts`. |
| **M4** | **`NaN` reservation bypass.** `reserve(NaN)` slipped past `maxAcu <= 0` and `available < maxAcu` (both false for `NaN`) and minted a hold. | Free AI + corrupted wallet. | `reserve` rejects non-finite / non-positive requests. `acu.ts`. |
| **M5** | **Free ACU via double-settle.** A stray double-`release`/`commit` drove `held` negative, **inflating** available balance. | Mint ACU from nothing. | `commit`/`release` clamp `held` and `balances` at 0. `acu.ts`. |
| **M6** | **Referral double-reward.** Engine had no per-order idempotency — a replayed "paid" callback issued the credits again. | Duplicate Crédit Tunakula. | Per-order guard (`rewardedRefs`, injectable for Redis/PG); an order rewards **at most once**, marked before issuing to beat concurrent replays. `referral.ts`. |
| **M7** | **Pay → reward → refund farm.** Rewards fired on *paid*; a fraudster could place a qualifying order, collect both credits, then cancel/refund and keep them. | Free credit farming. | Rewards now require the order to be **settled** (delivered & past the refund window) by default (`rewardRequiresSettlement`). `referral.ts`. |

---

## Verified safe (reviewed, no change needed)

- **Refund ladder** (`cuisine-sync.ts`): a refund to Crédit Tunakula is
  reachable **only** from `vendor-failed` / `rejected` — never after
  `accepted`, so a customer who received food cannot refund. The state guard
  makes a **second** `customer-chose-refund` throw, so no double-refund.
- **Order placement** (`order-adapter.ts`): `placeIdempotent` collapses the
  concurrent double-tap and recovers an ambiguous post — **never
  double-places**. Placing without paying creates an unpaid order that is
  simply never fulfilled (client-pays), so no loss.
- **Sender spoofing** (`parsers.ts`): a plain subscriber number texting the
  merchant SIM never parses as a payment (only operator shortcodes do).
- **Invalid amounts** (`parsers.ts` + `matcher.ts`): non-finite / ≤ 0
  amounts are rejected in two layers; `NaN` can't slide through tolerance.
- **Self-referral** and the **per-referrer cap** and **minimum order**:
  already enforced (`referral.ts`).
- **Resale multiplier**: fixed per-agent (seo/growth 3×); a partner cannot
  route around it by choosing an agent.

---

## Decisions for the owner (business, not code)

- **D-underpay:** default underpayment tolerance is **0 FC** (strict, no
  loss). If real operator behaviour ever needs a few FC of slack, ops raise
  `MatchTolerance.underpayFc` — a money decision, made explicitly.
- **D-2 (existing):** card can't meet the ×2 rule at the reference basket —
  surcharge / diaspora-only / drop at launch (ERRATA E-6).
- **Referral timing:** rewards now wait for settlement, so the referee's
  welcome credit lands after delivery, not at payment. Confirm this matches
  the promised UX; relax `rewardRequiresSettlement` only knowingly.

## Round 2 — full-permission seal (2026-08-25)

With explicit authorisation to close everything, the items previously
flagged as "decisions/deploy" that could be sealed in code now are, plus the
biggest structural vector: **price authority**.

| # | Loophole | Impact | Fix |
|---|---|---|---|
| **M8** | **Price / order_amount tampering.** `CartLine.price` and `PlaceOrderPayload.order_amount` are caller-supplied and StackFood trusts them. If the order builder ever copied a customer-influenced price, a customer could **pay less for real goods**. | The largest possible leak — buy real food at a declared price. | New **server-authoritative pricing** (`gateway/pricing.ts`): `priceOrder` computes every unit price from the menu (`PriceBook`) and derives `order_amount` — never accepts one. `verifyPayloadPricing` recomputes and **rejects any tampered payload** before placement. The matcher's "due" now traces to an authoritative total. |
| **M9** | **Cart abuse** — negative/zero/huge quantities, unknown items, mismatched add-on arrays. | Zero/negative totals, absurd orders, unpriced items. | `priceOrder` validates every line: quantity a positive integer ≤ 50, ≤ 50 lines, unknown food/add-on **fails closed** (never priced at 0), add-on arrays must align. |
| **M10** | **Negative order total.** `totalFc` subtracted discount/coupon with no floor — a discount above the gross made the total **negative (us paying the customer)**, and a negative discount inflated the charge. | We pay the customer / overcharge. | `totalFc` rejects negative discount/coupon and clamps reductions to the gross, so the total is **always ≥ 0**. `receipt.ts`. |
| **M11** | **Top-up / subscription funding** had no idempotent, payment-gated primitive — a replayed funding callback could double-credit ACU or double-grant a plan; a small payment could round **up**. | Free ACU balance / free entitlement. | New `ledger/funding.ts`: `fundAcuTopUp` is idempotent per funding-txn, **floors** the ACU credit, validates the amount; `grantSubscriptionPeriod` grants once per (account, plan, period) — no double-charge, no free extension. Both must be called only after the funding payment settles. |

**Now sealed in code (previously deploy-only notes):** top-up double-credit,
top-up-without-amount, over-credit rounding, subscription double-grant. The
idempotency **stores** still need Redis/PG in production (below), but the
**logic** that prevents the loss now exists and is tested.

## Deploy requirements (must hold in production stores)

- **Atomic, handle-idempotent ACU wallet.** The in-memory wallet is
  correct for the single-call contract; the production Redis/PG wallet must
  make `reserve`/`commit`/`release` atomic and idempotent per reservation id
  so concurrent AI calls can't oversell a balance.
- **Persistent replay index & reward guard.** `ReplayIndex` and the
  referral `rewardedRefs` are in-memory here; back them with Redis/PG so the
  "verify once / reward once" guarantees survive a restart.
- **Top-up only after settled payment.** When a top-up flow is built, credit
  ACU only after the funding payment verifies (same SMS Ledger discipline),
  and make the credit idempotent per funding-transaction id.
- **Litige/refund agent (Phase 2):** any future refund path must reuse the
  cuisine-sync guarantees — refund only non-delivered orders, once per order.
