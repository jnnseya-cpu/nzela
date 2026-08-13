# Customer Acquisition — the honest diagnosis & the plan

## Why zero customers so far (the blunt truth)

Not a missing feature. Not a missing AI agent. **The front door has never
been opened to the public.** As of now there is:

- no live public WhatsApp number a customer can message,
- no deployed running service,
- no landing page URL online (the file exists; it isn't hosted),
- no signed pilot restaurants, no recruited wewas,
- no single real order placed.

Software cannot acquire a customer it cannot receive. Building more agents
does not change this. **The one action that starts customer acquisition is
launching the manual channel** (`LAUNCH_TOMORROW.md`): a real WhatsApp
number + 3–5 restaurants + on-the-ground demand. Everything below
multiplies that; none of it substitutes for it.

## The acquisition stack (what's now built vs what's human work)

| Lever | Built? | Who acts |
|---|---|---|
| Live WhatsApp front door | ❌ needs number + deploy | Justin/ops |
| 3–5 signed restaurants + wewas | ❌ | Justin/ops (relationships) |
| Referral loop (word of mouth) | ✅ `@nzela/acquisition` | turn on at launch |
| First-order incentive | ✅ (referee reward) | set FC amount |
| Funnel analytics (find the leak) | ✅ | read weekly |
| Win-back / re-engagement targeting | ✅ | run when there's a base |
| SEO autopilot (organic search) | ✅ `@nzela/seo-agent` | needs hosting |
| Partner marketing generators | ✅ `@nzela/growth-engine` | restaurants self-market |

## The organic playbook (no ad spend), in order

1. **Open the door.** Manual WhatsApp channel live, number on posters/QR at
   the pilot restaurants and in Bandal WhatsApp groups. Week 1.
2. **Turn on the referral loop.** Every delivered order ends with the
   customer's code («Partage TK1234A — ton ami reçoit 2 000 FC, toi aussi
   quand il commande»). This is the highest-ROI organic channel in a
   community market and it's now abuse-proof: rewards fire ONLY on a
   referred new customer's real PAID first order (no fake-account farming).
3. **Make the first order irresistible.** First-order credit / livraison
   offerte, funded from the service fee — the referee reward is already
   wired.
4. **Let restaurants recruit their own customers.** The Growth Engine gives
   each partner ready social posts, adverts and best-posting-times — their
   existing followers become your customers at zero CAC.
5. **Squad orders.** Office/church/family WhatsApp groups → one pooled
   order. Kinshasa's natural social unit doing acquisition for free.
6. **SEO autopilot** for the diaspora and search demand ("livraison
   Bandal", "commander à Kinshasa") — compounding, once hosted.
7. **Measure and fix the leak.** `analyseFunnel()` tells you exactly where
   people drop (reach→start→confirm→pay→deliver). Fix the worst stage,
   repeat. Track the viral k-factor; k≥1 means growth self-sustains.
8. **Win back** with `winBackTargets()` — nudge cooling customers who still
   hold credit before they churn.

## What the AI agents genuinely do for acquisition

- **Growth Engine (#10):** partners generate their own marketing → they
  bring their audiences (organic, zero CAC).
- **SEO Agent (#9):** compounding search traffic on autopilot.
- **Referral + funnel + win-back (this package):** deterministic viral
  loop, leak diagnosis, and re-engagement — the mechanics that turn one
  customer into three.

They amplify a live product. They cannot create demand for a product that
isn't reachable. **Launch first; then these compound.**
