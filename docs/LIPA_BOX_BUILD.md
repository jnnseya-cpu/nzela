# Lipa Box — Build & Run Guide

The Lipa Box is deliberately boring hardware: **Android phones holding
your merchant SIMs, forwarding every incoming SMS to an HTTPS endpoint.**
The intelligence (parsing, matching, replay protection) lives server-side
in `backend/lipa-ingest` — the ingest endpoint is built and tested
(`server.ts`: `POST /lipa/sms`, `GET /healthz`).

## 1 · Hardware shopping list (≈ $150–250 total)

| Item | Spec | Why |
|---|---|---|
| 2 × Android phones | Any dual-SIM Android 9+, e.g. entry-level Samsung/Tecno/Infinix, ~$60–90 each | 2 phones × 2 SIMs = 4 operators; two devices = no single point of failure |
| 4 × merchant SIMs | M-Pesa (Vodacom), Orange Money, Airtel Money, Afrimoney — registered as **merchant/agent numbers** in the business name | Customers pay these numbers; confirmations arrive as SMS |
| Chargers + power strip (+ small UPS/power bank) | — | Kin power cuts must not kill payment verification |
| A locked drawer/box in the ops room | — | "Supervised" is a security control: these SIMs receive money |

Getting merchant SIMs: each operator's business/agent desk registers a
merchant line to Tunakula RDC (RCCM + ID). Ask explicitly for
**SMS confirmation on every received payment** (default behaviour).

## 2 · Phone setup (30 min per phone)

1. Factory reset → dedicated Google account (vault-stored password).
2. Screen lock + disable lock-screen notification previews.
3. Install ONE forwarder app. Working options, pick one:
   - **SMS to URL / Webhook forwarder** apps (Play Store — pick one with
     >100k installs and per-SIM support),
   - **MacroDroid** (free tier is enough: trigger = SMS received; action
     = HTTP POST),
   - **Tasker** (paid, most robust),
   - **android-sms-gateway** (open source) if you prefer auditable code.
4. Configure the forward rule — for every incoming SMS, POST JSON:
   `{ "from": "%sender", "body": "%message", "sim": "%slot" }`
   to `https://<your-host>/lipa/sms` with header
   `X-Lipa-Token: <shared secret from the vault>`.
5. Android settings: exclude the forwarder from battery optimization;
   enable auto-start; keep Wi-Fi + mobile data both on.
6. Test: send the phone any SMS → check it appears in the ingest logs
   (`/healthz` shows `lastSmsAgeSec` drop).

## 3 · Server side (already built — deploy it)

`createLipaIngest()` in `backend/lipa-ingest/src/server.ts` needs three
wires at deploy time: the shared token, an open-orders lookup, and the
"flip order to paid" callback (StackFood offline-payment verification or
wallet bridge — both in `@nzela/stackfood-client`). It already:

- authenticates the forwarder (constant-time token check),
- parses all four operators' confirmation formats,
- matches by TK ref + amount, falls back to unique exact amount,
- **burns every used reference and transaction id** (a code used once is
  dead forever — re-forwarded SMS and reused screenshots bounce),
- ignores non-payment SMS quietly, ledgers everything,
- exposes a heartbeat so ops alarms if a SIM goes silent.

## 4 · Commissioning test (launch gate — do all four)

For each operator: send yourself a small real payment (e.g. 1 000 FC)
with reference `TK-1` while a matching test order is open →
expect `verdict: "verified"` in ≤ 30 s. Then forward the same SMS again →
expect `verdict: "replay-rejected"`. Save each real SMS text — dev pins
the regexes to the exact wording and adds them as test fixtures.

## 5 · Daily ops

- 18h00: SIM inbox count ↔ ledger count ↔ StackFood paid orders — three
  numbers, must agree.
- Alert if `/healthz` heartbeat > 30 min during opening hours.
- Unmatched payment > 3 min → operator checks manually and messages the
  customer FIRST (FR-P4: the customer never asks "did you get my money?").

## Interim mode (launchable tomorrow, zero hardware wait)

Until phones/SIMs are commissioned, the operator reads the merchant SIM
inbox by eye and applies the same rules manually — including ticking
used TK codes in the paper register (the human replay index). See
`docs/LAUNCH_TOMORROW.md`.
