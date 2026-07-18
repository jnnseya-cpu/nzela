# NZELA-OS — Go-Live Checklist (Bandal soft launch)

**Target: live in 7 days.** Scope at launch: button + free-text ordering on
WhatsApp, cash + mobile money (all four operators via Lipa Box), 3–5 pilot
restaurants, 5–8 wewas, milestone tracking, exception ladder without TTS
(see D-2). Everything reads/writes cd.tunakula.com — the platform your
restaurant and delivery teams already administer.

Legend: ☐ open · owner in **bold** · ⚠ = critical path (start Day 1, has
external lead time we do not control).

---

## Day 1 (J-7) — unblock the critical path

- ☐ ⚠ **Justin** Meta Business verification for Groupe JNN started (can
  take 1–5 business days — nothing ships without it).
- ☐ ⚠ **Justin** Dedicated WhatsApp number acquired for the Cloud API
  (a number in WhatsApp-app use must be migrated — decide now).
- ☐ ⚠ **Dev** Six French utility templates submitted for Meta approval
  (FR-M3): resto new-order, resto reminder, wewa dispatch offer, customer
  payment-received, customer wewa-assigned, customer delivered/rating.
- ☐ ⚠ **Justin** Four merchant SIMs procured/confirmed (M-Pesa, Orange,
  Airtel, Africell) + one supervised Android for the Lipa Box.
- ☐ **Justin** Send dev team: one real confirmation SMS per operator
  (numbers redacted) + the four merchant numbers → regexes pinned to real
  formats same day.
- ☐ **Dev** Staging StackFood instance provisioned (never develop against
  prod) + Postman collection exported from the installed version and
  diffed against the Integration Spec (field-name ground truth).

## Day 2 (J-6) — platform configuration (in cd.tunakula.com/admin)

All of these are settings your teams already know — the WhatsApp channel
only mirrors them:

- ☐ **Ops** Per-restaurant coverage radius = 5 km (placement gate FR-R2).
- ☐ **Ops** Delivery zone charges = 3 500 / 5 000 / 7 000 FC
  (Zone 1/2/3) + rain/night multipliers.
- ☐ **Ops** Deliveryman commission = 70% (business settings).
- ☐ **Ops** Service fee 10% + processing 2% configured client-pays.
- ☐ **Ops** Offline Payment method "Mobile Money" enabled with required
  field `référence` (Pattern A) — if the installed version lacks it,
  dev switches to the wallet bridge (Pattern B), no scope change.
- ☐ **Ops** Categories/menus/prices/photos reviewed for the 3–5 pilot
  restaurants (photos feed the WhatsApp catalog as-is).
- ☐ **Dev** `nzela-admin` service account + one vendor token per pilot
  restaurant + one DM token per pilot wewa, stored in the vault.

## Day 3 (J-5) — integration live on staging

- ☐ **Dev** Gateway webhook endpoint deployed (HTTPS, HMAC secret set).
- ☐ **Dev** Flow 1: catalog pull + Redis cache TTLs (10/15/60 min)
  against staging; real category IDs verified (registry test green).
- ☐ **Dev** Flow 3: order placement end-to-end — order visible in the
  staging admin indistinguishable from a web order; idempotency retry
  test (same cart twice → one order).
- ☐ **Dev** Flow 5: status polling every 20 s → customer milestones
  (observer module is week-2 hardening, polling ships day 1 per spec).
- ☐ **Dev** Auth provisioning verified: first order auto-creates the
  StackFood account keyed to wa_id.

## Day 4 (J-4) — money

- ☐ **Dev+Ops** Lipa Box assembled: SMS forwarder → HTTPS ingest; test
  SMS from each of the four operators parsed, matched, order flipped to
  paid ≤ 30 s.
- ☐ **Dev** Replay test: same SMS forwarded twice → second rejected.
- ☐ **Dev** Cash path: COD order settles the 70/30 split correctly in
  the DM cash report; float ledger visible to ops.
- ☐ **Dev** Refund path: cancel + wallet credit lands as spendable
  Crédit Tunakula on a follow-up order.
- ☐ **Justin** Decide card copy: carte routes to cd.tunakula.com
  checkout at launch (in-chat payment links are post-pilot).

## Day 5 (J-3) — people

- ☐ **Ops** 3–5 pilot restaurants onboarded: WhatsApp number confirmed,
  order-card flow rehearsed (Accepter / prep time / Plat PRÊT), bag-tag
  routine (`sac TK-xxx`) explained.
- ☐ **Ops** 5–8 wewas onboarded: dispatch offer, code-match pickup,
  Livré/Cash reçu taps, float rules + 18h agent-point reconciliation.
- ☐ **Justin** Native French/Lingala speaker reviews every customer
  string (product principle 7) — receipt, milestones, refusals, receipts.
- ☐ **Dev** Ops alerting live: payment-match rate < 95%, order-place
  p95 > 3 s, webhook/polling lag > 60 s, escalation-ladder spikes.

## Day 6 (J-2) — full dress rehearsal (acceptance gate, §13)

Run on staging + real phones; every box must pass:

- ☐ End-to-end order: discovery → order → pay (momo) → accept → cook →
  dispatch → deliver → Bien reçu → rating; visible in admin throughout.
- ☐ Same flow with cash; float settles 70/30.
- ☐ 5 km rule fires at all three gates incl. polite substitution.
- ☐ Restaurant silence 60 s → escalation; both reroute and instant
  credit branches complete (TTS call per D-2 below).
- ☐ StackFood-down drill: kill staging 60 s mid-order → order queues in
  outbox, replays cleanly, customer sees no error.
- ☐ Firewall: off-topic probes get the canned redirect at 0 tokens.
- ☐ Cost meter over a 20-order batch: AI ≤ $0.05/order, messaging
  ≤ $0.024/order.
- ☐ Customer receipt shows only receipt fields (assertCustomerSafe in
  every send path).

## Day 7 (J-1) — production cutover

- ☐ **Dev** Production deploy; secrets rotated; admin routes
  IP-allowlisted; HMAC verified in prod.
- ☐ **Dev** Templates approved by Meta confirmed live (⚠ if still
  pending, launch waits — see Go/No-Go).
- ☐ **Ops** Landing page live with the real wa.me number; QR posters for
  pilot restaurants printed.
- ☐ **Justin** Soft-launch WhatsApp broadcast to the seed customer list
  (Bandal only).
- ☐ All: on-call rota for launch week agreed (dev + ops + Justin).

## Launch day (J-0)

- ☐ First real order placed by the team, end to end, before any
  customer.
- ☐ War-room open (WhatsApp group): dev, ops, Justin; ledger + admin
  dashboards on screen.
- ☐ Success criteria for day 1: ≥ 10 completed orders, 0 lost payments,
  every exception rescued via reroute or credit.

---

## Go/No-Go rules (decided at J-1 review)

**Go requires:** Meta templates approved · all Day 6 boxes green · Lipa
Box matching ≥ 95% on test batch · pilot restaurants + wewas rehearsed.

**Launch degrades gracefully, never blocks on:**
- Observer webhook module not ready → polling only (20 s) is the shipped
  fallback.
- TTS provider not selected (D-2) → escalation call is placed manually by
  ops on the alert; the reroute/credit branches are unaffected.
- Production catalog JSON not imported → pilot menus entered directly in
  admin are the catalog (it is the system of record anyway).

**No-Go if:** templates unapproved · payment match < 95% on rehearsal ·
any §13 money test failing (never launch with a broken money path).

---

## Deferred by design (explicitly NOT launch scope)

Adresse Vocale LLM parsing (buttons + typed addresses at launch; agents
are Phase 2) · Mama Upsell · Litige Agent (ops handles disputes manually
via wallet credit) · observer webhook module (week 2) · TTS automation
(D-2) · diaspora/BitriPay · USSD.

## Open decisions needed from Justin this week

- **D-1** WhatsApp number: new number vs migrate existing business number.
- **D-2** TTS telephony provider for escalation calls (open item #4) — or
  confirm manual ops calls for the pilot.
- **D-3** Seed customer list + launch promo (12% poulet banner is in the
  design — is it real?).
- **D-4** Merchant SIM numbers to print in payment instructions.
