# Analytics & Conversion Tracking (Meta Pixel + Google gtag)

NZELA-OS tracks in **two layers** because the real conversions happen inside
WhatsApp, not a browser:

1. **Web layer** — Meta Pixel + Google **gtag.js** (GA4 + optional Ads) on
   every web surface. Captures page views, WhatsApp-CTA clicks, PWA installs.
2. **Server layer** — Meta **Conversions API** + GA4 **Measurement
   Protocol**, fired from the money path (`@nzela/analytics`). Captures the
   real **Purchase** the moment a payment verifies in the Lipa Box. Deduped
   against the browser pixel by a shared `event_id`.

Both layers are **inert until real IDs are set** — safe to ship un-configured.

---

## 1. Web layer — one config, every surface

Single source of IDs: **`frontend/pwa/analytics.config.js`**. Replace the
placeholders once and every surface picks it up:

```js
window.NZELA_ANALYTICS_CONFIG = {
  metaPixelId: "123456789012345",   // your Meta Pixel ID
  ga4Id:       "G-XXXXXXXXXX",       // your GA4 Measurement ID
  googleAdsId: "AW-XXXXXXXXXX",      // optional — Google Ads
  consent:     true                  // false hard-disables everything
};
```

The loader **`frontend/pwa/analytics.js`** is included after the config on
each surface (both `defer`, order preserved):

```html
<script src="../pwa/analytics.config.js" defer></script>
<script src="../pwa/analytics.js" defer></script>
```

**Wired on:** landing, partner-dashboard, blog (all 14 pages — the kit is
copied into `frontend/blog/` at build), the interactive prototype.
**ops-console** inherits it when scaffolded (see its README).

### What fires automatically
| Trigger | Meta event | GA4 event |
|---|---|---|
| Page load | `PageView` | `page_view` (via gtag config) |
| Click on any `wa.me` / WhatsApp link | `Contact` | `whatsapp_click` |
| Click on `[data-track="name"]` element | mapped¹ | `name` |
| PWA installed | `pwa_install` (custom) | `pwa_install` |

¹ `whatsapp_click→Contact`, `begin_checkout→InitiateCheckout`,
`generate_lead→Lead`, `purchase→Purchase`, `sign_up→CompleteRegistration`.

### Fire a custom event from any surface
```js
nzelaTrack("begin_checkout", { value: 22540, currency: "CDF", label: "Poulet Mayo" });
```
It goes to **both** platforms with one shared `event_id`.

---

## 2. Server layer — `@nzela/analytics`

Set these environment variables where the gateway / lipa-ingest run:

```
META_PIXEL_ID=123456789012345
META_CAPI_TOKEN=<Conversions API access token>
META_TEST_EVENT_CODE=TEST12345   # optional, Events Manager "Test events" tab
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_SECRET=<GA4 Measurement Protocol API secret>
```

Build the spine and inject it into the money path:

```ts
import { spineFromEnv } from "@nzela/analytics";
const analytics = spineFromEnv();          // inert if the vars are unset
createLipaIngest({ /* ...*/, analytics }); // fires Purchase on verify
```

- **Purchase** is emitted the instant a payment matches an open order
  (`backend/lipa-ingest/src/server.ts`), with `value` (FC), `currency: CDF`,
  `order_id = tkRef`, and the operator.
- User PII (phone/email/wa_id) is **SHA-256 hashed** before it leaves the
  process (Meta advanced-matching spec). Raw identifiers never transmit.
- `event_id = "Purchase:<tkRef>"` matches the browser pixel's Purchase, so
  Meta/GA4 count one conversion, not two.
- **Fail-safe:** the spine never throws — analytics can never break the
  order or payment path. Unconfigured sinks report `skipped`.

---

## 3. Verify it works

- **Meta:** Events Manager → your Pixel → Test events (use
  `META_TEST_EVENT_CODE`); browser events show `action_source: website`,
  server events `system_generated`, matched by `event_id`.
- **GA4:** Admin → DebugView (web) and Realtime; server events arrive via
  Measurement Protocol with `transaction_id = tkRef`.
- **Code:** `pnpm test` covers hashing, dedup id, payload shape, the
  inert-when-unconfigured path, and the never-throws guarantee.

---

## 4. Privacy / consent notes

- Set `consent: false` in the config to disable all web tracking (e.g. until
  a cookie banner is accepted). The server layer only ever sends hashed IDs.
- The humans-only gate (`@nzela/security`, ERRATA E-8) still governs access;
  analytics is measurement only and never an auth path.
