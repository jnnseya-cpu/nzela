/*
 * ─────────────────────────────────────────────────────────────────────────
 *  SINGLE SOURCE OF TRUTH for the customer-facing WhatsApp number.
 *
 *  ⇩⇩⇩  TO GO LIVE: change WA_NUMBER to your real +243 line (digits only,
 *       no "+", no spaces), then rebuild:
 *
 *         pnpm build:blog && pnpm build:site
 *
 *  That one edit propagates to EVERY public surface — landing, blog (all
 *  posts + index + 404), partner dashboard — because:
 *    • the blog generator (_generate.ts) reads `waLink` from here, and
 *    • the site build (build.mjs) swaps the baked-in number for WA_NUMBER
 *      across the whole assembled site.
 *
 *  Today it is the +44 pilot line. For a Kinshasa audience a +44 number
 *  reads as foreign/scam — this is launch-blocking decision D-1. Swapping it
 *  here is now the whole job.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Customer-facing WhatsApp number, digits only (E.164 without the leading +). */
export const WA_NUMBER = "447493216101";

/** wa.me deep link with a prefilled first message (URL-encoded). */
export const waLink = (text = "Nakolia") =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

/** Pretty +country form for display, e.g. "+44 7493 216101" style is skipped —
 *  callers that need a display string can format WA_NUMBER themselves. */
export const WA_DISPLAY = `+${WA_NUMBER}`;
