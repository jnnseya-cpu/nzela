# NZELA Ops Console

Next.js 14 app (Phase 1+) serving two surfaces:

1. **Entry page** mirroring the cd.tunakula.com StackFood UX (FR-D1) —
   search pill, promo carousel, category row, "Popular Restaurants Nearby",
   bottom nav with the central WhatsApp FAB. Every CTA deep-links into the
   WhatsApp conversation (`wa.me` with prefilled context). The authoritative
   UX contract is `docs/prototype/tunakula-nzela-os-interactive.html`.
2. **Ops console** — per-order event ledger (Registre), AI spend meter,
   WhatsApp conversation-cost meter, payment-match alerting, rain-mode
   toggle (FR-R5), and the cuisine-gap coverage analytics of FR-R6.

Not yet scaffolded: waiting on Next.js app bootstrap in Phase 1. The data
contracts it consumes live in `@nzela/ledger`.

**When scaffolded, it must include the shared analytics kit** (Meta Pixel +
Google gtag) like every other surface — add to the app `<head>`:

```html
<script src="/pwa/analytics.config.js" defer></script>
<script src="/pwa/analytics.js" defer></script>
```

Server-side conversions (order placed / payment verified) are already
emitted from the money path via `@nzela/analytics` (Meta CAPI + GA4 MP).
