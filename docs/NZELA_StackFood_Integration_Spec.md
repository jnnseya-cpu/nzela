# NZELA-OS ↔ StackFood Integration Specification
## WhatsApp Channel → drc.tunakula.com (StackFood Backend) — API Contract v1.0
**Groupe JNN — Tunakula CD | Engineering | Confidential**

> ⚠️ Endpoint paths below follow StackFood's standard v1 REST API (the same API its Flutter customer/vendor/delivery apps consume). Exact paths and payload fields vary slightly by StackFood release — before build, export the Postman collection from the installed version at drc.tunakula.com and verify each route. Treat this document as the contract; treat the Postman export as ground truth for field names.

---

## 1. Architecture Principle

**StackFood is the system of record. NZELA-OS is a headless channel.**

NZELA-OS never stores its own catalog, prices, or order ledger. It reads the catalog from StackFood, writes orders into StackFood, and mirrors StackFood order states out to WhatsApp as milestone templates. The admin panel at drc.tunakula.com remains the single operational dashboard; a WhatsApp order and a web order are indistinguishable in reporting.

```
 Customer WhatsApp ──▶ Meta Cloud API ──▶ NZELA Gateway (webhook server)
                                              │
                    ┌─────────────────────────┼──────────────────────────┐
                    ▼                         ▼                          ▼
             Agent layer                Order Adapter              Lipa Box svc
        (Commande/Adresse/Upsell)   (this spec: REST calls)     (SMS → payment)
                    │                         │                          │
                    └────────────▶  StackFood API  ◀────────────────────┘
                                   drc.tunakula.com/api/v1
                                          │
                          Admin panel · Vendor app · DM app · Web store
```

Components on the NZELA side:
- **Order Adapter** — the only component that talks to StackFood. Stateless REST client with retry, idempotency, and a Redis cache.
- **Sync Worker** — scheduled jobs: catalog refresh, order-state polling fallback, token refresh.
- **Webhook Receiver** — accepts pushes from the custom StackFood observer module (Section 7).

---

## 2. Environments, Auth & Identity

| Item | Value |
|---|---|
| Base URL (prod) | `https://drc.tunakula.com/api/v1` |
| Base URL (staging) | `https://staging.tunakula.com/api/v1` (to be provisioned — never develop against prod) |
| Content type | `application/json` |
| Zone header | `zoneId: [<zone_id>]` required on catalog endpoints |
| Customer auth | Bearer token from `/auth/login` |
| Vendor / DM auth | Bearer tokens from `/auth/vendor/login` and `/auth/delivery-man/login` |

**Identity strategy — one StackFood customer per WhatsApp number.**
On first order, the Adapter auto-provisions a StackFood account keyed to the customer's `wa_id` (E.164 phone):

1. `POST /auth/register` → `{ f_name, l_name, phone, email: <phone>@wa.tunakula.com, password: <vault-generated> }`
2. `POST /auth/login` → bearer token, cached in Redis (`token:cust:<wa_id>`, TTL per StackFood token lifetime, refresh on 401).
3. Passwords live only in the NZELA secrets vault; customers never see them. If the customer later installs the app, admin can trigger a password reset to hand them the same account — order history intact.

If the installed StackFood version supports **guest checkout** (`/auth/guest/request`), use it only as a degraded fallback; the provisioned-account path is required for wallet (Crédit Tunakula), address reuse, and refunds.

Service accounts (stored in vault, rotated quarterly):
- `nzela-admin` — admin-level for wallet credits and payment status updates (Section 6).
- One **vendor token per restaurant** (obtained at onboarding) — lets Cuisine Sync act on the restaurant's behalf when they tap WhatsApp buttons.
- One **DM token per wewa** — lets Dispatch act on the driver's behalf.

---

## 3. Flow 1 — Menu Pull & WhatsApp Catalog Sync

Read-only. Runs as: full sync nightly 04:00 + on-demand per conversation (cache-first).

| Step | Endpoint | Notes |
|---|---|---|
| Resolve zone | `GET /config/get-zone-id?lat={lat}&lng={lng}` | From Adresse Vocale centroid; returns `zone_id` for the `zoneId` header |
| Global config | `GET /config` | Currency, delivery-charge model, min order, scheduled-order flag |
| Restaurant list | `GET /restaurants/get-restaurants/all?offset=1&limit=50` + `zoneId` header | Filter `open == 1`; sort by distance to customer centroid |
| Restaurant detail | `GET /restaurants/details/{restaurant_id}` | Opening hours, delivery time, ratings — feeds "prêt en X min" copy |
| Categories | `GET /categories` and `GET /categories/products/{category_id}` | Optional; Mama Tunakula usually flattens to dishes |
| Products | `GET /products/latest?restaurant_id={id}&offset=1&limit=100` | Name, price, `image_full_url`, variations, add-ons, `available_time_starts/ends` |
| Search (free-text) | `GET /products/search?name={q}&restaurant_id={id}` | Backs the Commande Agent: after LLM extraction, resolve each item to a `product_id` here — never trust the LLM with IDs |

**Cache policy (Redis):** restaurant list 10 min · product list per restaurant 15 min · config 60 min · bust on webhook `product.updated` if the observer module is installed. Cached reads cost 0 tokens and 0 StackFood load — the deterministic spine serves from cache.

**Photos:** `image_full_url` values are pushed to the WhatsApp Business **Product Catalog** via Meta's Catalog API (batch upsert nightly, keyed `retailer_id = stackfood_product_id`). One catalog per city; restaurant = collection. This is how the customer sees real photos in-chat at zero token cost — the same images already uploaded to drc.tunakula.com.

---

## 4. Flow 2 — Address & Zone (Adresse Vocale → StackFood address)

StackFood addresses are lat/lng + text fields; the Landmark Graph provides both.

| Step | Endpoint |
|---|---|
| Create | `POST /customer/address/add` |
| List / reuse | `GET /customer/address/list` |

Field mapping (contract for the Adresse Agent):

| StackFood field | NZELA source |
|---|---|
| `address` | Rendered landmark chain: *"Bandal, Q. Sainte-Anne, 2e avenue, après l'église, portail vert"* |
| `latitude` / `longitude` | Landmark Graph centroid (± refined by driver confirmation on first delivery) |
| `address_type` | `home` \| `office` \| `others` — from customer chip choice |
| `road` / `house` / `floor` | avenue / door descriptor / — |
| `contact_person_number` | `wa_id` |

After first successful delivery, Papy's confirmed pin PATCHes the address (`/customer/address/update/{id}`) — the Landmark Graph and StackFood stay in lockstep.

**Delivery fee:** computed by StackFood from its zone/per-km config at order time. NZELA displays it in the récap but never calculates it independently — one pricing brain. Configure StackFood zone charges to match the Zone 1/2/3 landmark-ring tariff (3 500 / 5 000 / 7 000 FC) and the 70/30 DM commission in admin → business settings (deliveryman commission = 70%).

---

## 5. Flow 3 — Order Creation

`POST /customer/order/place` (customer bearer token) — called by the Order Adapter the instant the customer confirms the récap.

```json
{
  "cart": [
    {
      "food_id": 1042,
      "item_campaign_id": null,
      "price": 15000,
      "variant": "",
      "variations": [],
      "add_ons": [],
      "add_on_qtys": [],
      "quantity": 2
    },
    { "food_id": 1088, "price": 2000, "quantity": 1, "variations": [], "add_ons": [] }
  ],
  "order_amount": 35840,
  "payment_method": "cash_on_delivery",
  "order_type": "delivery",
  "restaurant_id": 17,
  "distance": 1.8,
  "address": "Bandal, Q. Sainte-Anne, 2e avenue, après l'église, portail vert",
  "latitude": "-4.3419",
  "longitude": "15.2663",
  "contact_person_name": "Client WA",
  "contact_person_number": "+243810000047",
  "address_type": "home",
  "road": "2e avenue", "house": "portail vert", "floor": "",
  "dm_tips": 0,
  "order_note": "NZELA TK-347 · sans piment",
  "schedule_at": null
}
```

Rules:
- **`payment_method` mapping:** Cash → `cash_on_delivery` · Crédit Tunakula → `wallet` · Mobile Money via Lipa Box → see Section 6 (offline/wallet pattern).
- **`order_note` always carries the NZELA short code** (`TK-347`) — it is the human-readable join key printed on the wewa pickup card and quoted in M-Pesa references.
- Response returns `order_id`; the Adapter stores the pair `TK-347 ↔ order_id` in Redis + Postgres (`nzela_order_map`).
- **Idempotency:** the Adapter computes `Idempotency-Key = sha256(wa_id + cart_hash + minute_bucket)`; on network retry it first checks `GET /customer/order/list?limit=5` for a matching `order_note` before re-posting. Never double-place.
- Price integrity: the Adapter re-prices the cart from cached catalog data server-side; the LLM's parsed prices are display-only.

---

## 6. Flow 4 — Payment Reconciliation (Lipa Box ↔ StackFood)

StackFood has no M-Pesa RDC gateway — which is exactly why NZELA exists. Two supported patterns; use **A** if the installed version has Offline Payment, else **B**.

**Pattern A — Offline Payment method (preferred, StackFood ≥ v7.x):**
1. Admin enables an offline payment method "Mobile Money (M-Pesa/Orange/Airtel/Africell)" with required field `référence` .
2. Order is placed with `payment_method: "offline_payment"` + `payment_info: { "référence": "TK-347" }` → order enters *pending verification*.
3. When the Lipa Box matches the confirmation SMS to `TK-347`, the Adapter calls the admin verification route to flip the offline payment to **verified** → StackFood marks the order paid and notifies the vendor normally.

**Pattern B — Wallet bridge (works on any version):**
1. Lipa Box matches SMS → Adapter (admin token) `POST /admin/customer/wallet/add-fund` `{ customer_id, amount, reference: "MPESA QGH7X2 / TK-347" }`.
2. Adapter immediately places (or re-confirms) the order with `payment_method: "wallet"` — the just-credited balance settles it atomically.
3. Refunds are the same rail in reverse: cancel order + wallet credit = **Crédit Tunakula refund in one call, no money movement** (the 40-second litige close in the demo).

Either pattern, the invariant holds: **money state lives in StackFood**; the Lipa Box only submits evidence.

---

## 7. Flow 5 — Status Sync (both directions)

### 7.1 Inbound to StackFood (WhatsApp buttons → API)

| WhatsApp action | Actor token | StackFood call |
|---|---|---|
| Resto taps **Accepter — 25 min** | vendor | `POST /vendor/order/update-status` `{ order_id, status: "confirmed", processing_time: 25 }` |
| Resto taps **Plat PRÊT** | vendor | `POST /vendor/order/update-status` `{ order_id, status: "handover" }` (preceded by `processing` when cooking starts) |
| Wewa taps **Je prends** | dm | `POST /delivery-man/accept-order` `{ order_id }` |
| Wewa taps **Récupéré (code ok)** | dm | `POST /delivery-man/update-order-status` `{ order_id, status: "picked_up" }` |
| Wewa taps **Livré / Cash reçu** | dm | `POST /delivery-man/update-order-status` `{ order_id, status: "delivered" }` — for COD, StackFood books the cash into the DM's collected-cash ledger (float reconciliation uses the built-in DM cash report) |
| Milestone location pings | dm | `POST /delivery-man/record-location-data` `{ order_id, latitude, longitude }` — sent only at the 3 waypoint taps, not streamed (data-light by design) |
| Customer cancels / litige refund | customer/admin | `POST /customer/order/cancel` `{ order_id, reason }` + wallet credit (6.B.3) |

### 7.2 Outbound from StackFood (order events → WhatsApp templates)

**Primary: custom webhook module** (thin Laravel package installed on drc.tunakula.com):
- `OrderObserver` on the `Order` model fires on status/payment change → `POST https://nzela.tunakula.com/hooks/stackfood`
- Payload: `{ event: "order.status_changed", order_id, old_status, new_status, payment_status, restaurant_id, delivery_man_id, ts }`
- Security: `X-NZELA-Signature: hmac_sha256(body, shared_secret)`, 3× retry with backoff, dead-letter table in StackFood DB.
- ~120 lines of code; zero core-file edits (observer + service provider), survives StackFood upgrades.

**Fallback: polling** — Sync Worker `GET /customer/order/list` (per open order token) or admin order list every 20 s for orders in non-terminal states. Ship polling on day 1; add the observer module in week 2.

### 7.3 Status → milestone mapping (single source of truth)

| StackFood status | NZELA milestone | WhatsApp message (customer) | Cost |
|---|---|---|---|
| `pending` | Créée | "Commande envoyée 🙏" | free (service window) |
| `confirmed` | Acceptée | "👩🏾‍🍳 {resto} a accepté — prête vers {eta}" | free |
| `processing` | En cuisine | "🔥 En cuisine" | free |
| `handover` | Prête | "🍳 C'est prêt — {wewa} arrive au resto" | free |
| `picked_up` | En route | "🏍️ {wewa} est en route · {eta} min" + waypoints | free |
| `delivered` | Livrée | "📍 Au portail!" → "Bien reçu?" → rating | free |
| `canceled` | Annulée | litige script → reroute / Crédit | free |
| `failed`/`refunded` | Remboursée | "🎟️ {montant} crédités" | free |
| (60 s no vendor response) | Exception | Cuisine Sync voice call + plan B options | 1 utility template if resto window closed (~$0.008) |

---

## 8. Non-Functional Contract

- **Idempotency everywhere:** every mutating call carries the `TK-xxx` code in a note/reference field; the Adapter checks-before-writes on retry.
- **Timeouts/retry:** 5 s connect / 10 s read; 3 retries exponential (1s/3s/9s) on 5xx and network only — never retry a 4xx.
- **Rate budget:** ≤ 10 req/s sustained to StackFood; catalog served from cache so live traffic is order-writes + status only.
- **Failure mode:** if StackFood is down, NZELA queues the order locally (Postgres outbox), tells the customer "confirmée, reçu suit", and flushes on recovery — WhatsApp UX never blocks on backend latency.
- **Observability:** every Adapter call logged with `tk_code, endpoint, latency, status`; alert if order-place p95 > 3 s or webhook lag > 60 s.
- **Security:** all service tokens in vault; StackFood admin API calls IP-allowlisted to the NZELA VPC; webhook HMAC verified; PII (phone numbers) encrypted at rest in `nzela_order_map`.

---

## 9. Build Plan & Acceptance Tests

**Week 1:** staging clone of drc.tunakula.com · Postman export & path verification · Adapter skeleton (auth, catalog pull, cache) · WhatsApp catalog batch upsert.
**Week 2:** order place + COD end-to-end · status polling → milestone templates · vendor/DM token onboarding for pilot partners.
**Week 3:** Lipa Box → Pattern A/B payment verification · wallet refunds · webhook observer module deployed.
**Week 4:** exception paths (vendor timeout, reroute, cancel) · load test 50 concurrent orders · pilot go-live (Bandal, 15 restaurants).

Acceptance checklist (all must pass on staging):
1. WhatsApp order appears in drc.tunakula.com admin within 3 s, indistinguishable from a web order.
2. Vendor tap in WhatsApp changes StackFood status; StackFood status change fires the correct customer template within 5 s.
3. Lipa Box SMS flips an offline-payment order to paid with no human touch.
4. Refund lands as wallet credit and is spendable on the next WhatsApp order.
5. Kill StackFood for 60 s mid-order → order queues and flushes, customer sees no error.
6. Same cart double-submitted on retry produces exactly one order.

---
*Contract owner: NZELA Order Adapter team · Change control: any StackFood upgrade requires re-running the Postman diff against this spec before deploy.*
