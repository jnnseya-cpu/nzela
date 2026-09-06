# Why we still can't take the market by storm (2026-09-06)

**One line: we are 100% built and 0% live.** 250+ tests, a premium site, a
real order engine, a unified deploy — and not one thing that touches a real
customer. You cannot storm a market that has never been able to reach the
product.

## The truth from STATUS.md (not opinion)
Nothing is deployed. No running server, no hosting, no live URL. No live
WhatsApp Cloud API. No live cd.tunakula.com wiring. Lipa Box not
commissioned. **No real customer, no real payment tested end-to-end.**

## Where a real order dies today — the blocking chain
1. No live WhatsApp number a customer can message (the published one is a
   **+44 UK line** → reads as *arnaque* to a Kinois).
2. The marketing site isn't hosted at a public URL (`dist/` assembles; nobody
   pushed it).
3. The gateway server runs nowhere (no host, no Redis/Postgres).
4. No StackFood service tokens → can't read a menu or place a real order.
5. No signed restaurant → nobody to cook.
6. No wewa → nobody to deliver.
7. No merchant SIMs / Lipa Box → no mobile-money payment ever verified.

Every one is operational or a credential. **None is code.**

## Why it stays stuck (brutal)
- **Polish is safe; launch is scary.** Each session added something good —
  but each was also a way to avoid putting a number live, signing a resto,
  taking one real order. The repo grew; the business didn't move toward a
  customer.
- **The go-live has no owner and no live deadline.** "This Saturday" passed
  weeks ago.
- **Launch-gating decisions were never made** — the +243 number (D-1),
  merchant SIMs, which 3 restaurants. Undecided = unlaunched.
- **The acquisition machine is aimed at a closed door** — SEO, growth,
  referral, newsletter all built, pointed at a channel that isn't on.

## Even after go-live — what will still blunt the storm
- **Density before ads.** The 5 km rule needs enough restos + wewas in Bandal
  at once, or first orders arrive cold and word-of-mouth turns negative.
- **The +44 number** suppresses every organic share until it's +243.
- **Single-instance in-memory stores** lose state on restart — fine for a
  pilot, fatal at spike. Wire Redis/Postgres before pushing volume.

## The unlock — a 48–72h operational sprint (owner: Justin, not code)
1. +243 number + WhatsApp Cloud API live.
2. Host the site + the gateway/lipa services.
3. Sign 3 restaurants + 5 wewas in Bandal, rehearsed.
4. Wire StackFood service tokens; one real test order.
5. Verify **one real mobile-money payment** end-to-end.

Until steps 1–5 happen, no commit moves the needle. The code is ready for all
of them.
