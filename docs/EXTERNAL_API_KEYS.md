# External API keys & credentials to go live

Grounded in what the code actually calls (`graph.facebook.com`,
`google-analytics.com/mp/collect`) and reads (`META_*`, `GA4_*`, gateway
config). **Excludes** what you already have: AI/LLM keys, the StackFood API
(`cd.tunakula.com`), and SMTP.

## 🔴 Critical — nothing works without this

### 1. WhatsApp Cloud API (Meta) — the front door
| Item | Where it plugs in |
|---|---|
| WhatsApp Business **number (+243)** | the customer-facing line (via Meta or a BSP) |
| **Permanent access token** (System-User, `whatsapp_business_messaging`) | the `WhatsAppSender` adapter (sends replies via `graph.facebook.com`) |
| **Phone Number ID** + **WABA ID** | send + template management |
| **App Secret** | verify inbound webhooks (`X-Hub-Signature-256`) |
| **Webhook Verify Token** (a string you choose) | `GatewayConfig.waVerifyToken` |

Without this there is no channel — a customer cannot send a single message.

## 🟠 Analytics & marketing — env vars the code already reads

### 2. Meta Pixel + Conversions API
`META_PIXEL_ID`, `META_CAPI_TOKEN` (System-User token, conversions perm),
`META_TEST_EVENT_CODE` (optional). Same Pixel ID → `frontend/pwa/analytics.config.js`.

### 3. Google Analytics 4
`GA4_MEASUREMENT_ID` (G-XXXX) + `GA4_API_SECRET` (Measurement Protocol).
Same measurement ID → `frontend/pwa/analytics.config.js`.

### 4. Google Ads — optional (Phase 2)
`AW-XXXX` conversion ID in `analytics.config.js`, only when running paid ads.

## 🟡 Optional (Phase 2)

### 5. Telephony provider (Twilio Voice / Africa's Talking)
Only for the automated voice-call to a silent restaurant (60 s escalation).
The pilot uses **manual ops calls**, so not needed day 1. Not an AI key.

## ⚙️ Required credentials that are NOT "API keys"

- **Redis** (URL + auth) — durable replay index, ACU wallet, rate limiter,
  sessions, funding ledger, token cache.
- **Postgres** (connection string) — ledger, order map, subscribers/consent,
  referral resolvers.
- **Hosting** — a static host for the site + a Node host (VPS/Render/Fly) for
  the gateway & lipa services.

## ✅ Explicitly NOT needed (don't chase these)

- **No mobile-money operator API** — the SMS Ledger Bridge avoids it by
  design. You need merchant **SIM cards** + the **Lipa Box** forwarder (a
  self-generated `ingestToken`, not an external key).
- **No Maps/Geocoding API** — the Landmark Graph replaces GPS.
- **No card-gateway keys in our code** — card runs through StackFood's
  `digital_payment`, configured inside the existing StackFood admin.
- No AI/LLM keys, no new StackFood key, no SMTP (already handled).

**Bottom line:** the real shopping list is **WhatsApp Cloud API (critical),
Meta Pixel/CAPI, GA4.** The rest is infra credentials, SIMs/hardware, or
deliberately avoided.
