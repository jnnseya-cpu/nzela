/*
 * Tunakula analytics config — the SINGLE source of tracking IDs for every
 * web surface (landing, blog, partner-dashboard, ops-console, prototype).
 *
 * Replace the __PLACEHOLDER__ values with your real IDs before deploy.
 * While they remain placeholders, analytics.js stays completely inert — no
 * network calls, no errors — so the site is safe to ship un-configured.
 *
 *   metaPixelId : Meta Pixel ID          e.g. "123456789012345"
 *   ga4Id       : GA4 Measurement ID      e.g. "G-XXXXXXXXXX"
 *   googleAdsId : Google Ads ID (optional) e.g. "AW-XXXXXXXXXX"
 *   consent     : set to false to hard-disable all tracking
 */
window.NZELA_ANALYTICS_CONFIG = {
  metaPixelId: "__META_PIXEL_ID__",
  ga4Id: "__GA4_MEASUREMENT_ID__",
  googleAdsId: "",
  consent: true,
};
