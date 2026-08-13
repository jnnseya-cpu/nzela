# SATURDAY GO-LIVE RUNBOOK — manual channel, Bandal

**Launch: Saturday. Path: human-operated WhatsApp channel on the live
cd.tunakula.com** (KODA Door 1). No Meta approval, no deploy, no SIMs
required to take the first order — real money on Saturday, safely.
Full detail: `LAUNCH_TOMORROW.md`. This is the countdown.

Legend: **[J]** Justin/ops · **[O]** operator · ⚠ = must-have for Saturday.

---

## THURSDAY (today) — set up the door

- ☐ ⚠ **[J]** Dedicate an Android + the Tunakula WhatsApp number; install
  **WhatsApp Business App** (free app, NOT the Cloud API). Set name
  "Tunakula — Mama Tunakula", photo, and greeting.
- ☐ ⚠ **[J]** Confirm the 4 merchant mobile-money numbers (M-Pesa, Orange,
  Airtel, Africell) that customers will pay. Cash is ready by default.
- ☐ ⚠ **[J]** Lock the 3–5 pilot restaurants (WhatsApp confirmed) and 5–8
  wewas. This is THE gate — no restaurants, no launch.
- ☐ **[J]** Put the landing page online: host `frontend/landing/landing.html`
  (Netlify Drop or the site server) and replace `243000000000` in the
  `wa.me` links with the real number. Same for `splash.html`.
- ☐ **[O]** Read `LAUNCH_TOMORROW.md` operator flow end to end once.

## FRIDAY — rehearse & seed

- ☐ ⚠ **[J+O]** Set up WhatsApp Business **quick replies** with the scripts
  (welcome, resto list, récap with fees, payment instructions per operator,
  milestones, receipt). Print the TK-code carnet (numbered).
- ☐ ⚠ **[O]** Dry run: place 3 fake end-to-end orders (1 cash, 1 momo, 1
  card→web) with a colleague. Verify: récap shows all fees, payment SMS
  read correctly, order entered in cd.tunakula.com admin with note
  "NZELA TK-xxx", milestones sent, receipt clean, TK code ticked as used.
- ☐ ⚠ **[J]** Set the **first-order incentive** (e.g. livraison offerte or
  2 000 FC credit) and the **referral reward** amounts — the acquisition
  loop is the growth engine from day one.
- ☐ **[J]** Confirm each restaurant's menu, prices, photos, and 5 km zone
  are correct in the admin (that data is what the operator quotes).
- ☐ **[J]** Prepare the launch broadcast + QR posters for the pilot
  restaurants and 3–5 Bandal WhatsApp groups.

## SATURDAY — GO

**Go/No-Go (morning): GO only if** ≥3 restaurants confirmed AND the Friday
dry run passed AND at least cash + one mobile-money operator verified.

- ☐ **[team]** One real staff order, paid, delivered, before opening to the
  public.
- ☐ **[J]** Send the launch broadcast; put up QR posters; post in the
  Bandal groups. Every message ends with the referral code line.
- ☐ **[O]** War-room open (dev-optional; ops + Justin). Admin dashboard +
  the paper register on screen.
- ☐ **Day-1 success:** ≥10 completed orders, 0 lost payments, every
  exception resolved by reroute or instant credit. Log each order in the
  register (TK-ref, resto, total, pay mode, SMS-verified Y/N, status).

## Turn on the acquisition loop from order #1

Every delivered order closes with: «Merci! Partage ton code **TK1234A** —
ton ami reçoit {refereeReward} FC, et toi {referrerReward} FC quand il
commande.» Rewards fire only on a referred new customer's real paid first
order (abuse-proof). This is how 10 orders becomes 30.

## What is NOT in Saturday scope (and doesn't block it)

Automated bot / WhatsApp Cloud API (Meta approval pending), the deployed
gateway + Lipa ingest, LLM agents (Commande/Adresse voice, SEO, Growth
generators). All ready in code; they replace the human operator over the
following 1–2 weeks with zero customer-visible change. Saturday is humans
running proven rails — the safe way to have real customers this weekend.

## The only things that can stop Saturday

1. No restaurants signed → **hard stop.** (Human task, do it Thursday.)
2. No WhatsApp number live → hard stop. (Human task.)
3. No payment path verified → run cash-only Saturday, add momo when ready.

None of these are code. The code is done and tested (162 tests green).
Saturday is won or lost on the phone number, the restaurants, and the
posters — start those today.
