# NZELA-OS — Go-To-Market Plan
### Tunakula-Congo · Bandalungwa (Bandal), Kinshasa · Groupe JNN

**One line:** Launch a WhatsApp-native, cash-first food-delivery channel in
Bandal, get to the first 100 paying customers in 30 days through
restaurant-seeded word-of-mouth and a referral loop, and prove ≥ ×2 profit
per order before expanding quartier by quartier.

> Grounded in the repo's committed assets: unit economics (§8, ×2 rule),
> the competitive analysis, the acquisition engine (referral/funnel/win-back),
> the SEO blog + newsletter, and the launch runbooks. Numbers here are the
> same ones enforced in code — not marketing invention.

---

## 1. The wedge (why we win, in three sentences)

The Uber Eats model is dead in Africa — Jumia Food shut all 7 countries in
Dec 2023 having "never been profitable," Glovo takes 25–35% from restaurants
and isn't even in the DRC, and the local apps (Dosta, Tikkotac,
AngataDelivery, CongoEats) all demand an app install the mass market won't do.
**NZELA-OS assumes the opposite:** WhatsApp is already installed, payment is
cash or mobile-money SMS, and addresses are landmarks. **Our unfair
advantages are structural** — the SMS Ledger Bridge (mobile money with no
operator API), the Landmark Graph (a proprietary map of Kin), and a
client-pays model where the restaurant keeps 100% of its menu price.

---

## 2. Customer & supplier segments

This is a **two-sided marketplace**: "suppliers" = restaurants + wewas
(drivers); "customers" = eaters. Both must be sourced in Bandal first for
density (the 5 km rule makes density the whole game).

### 2.1 Demand — customer segments (priority order)
1. **Young WhatsApp-native Kinois (18–35), Bandal** — order for themselves,
   cash or mobile money. *Primary beachhead.*
2. **Squad orders** — office / church / family WhatsApp groups pooling one
   delivery. Kinshasa's natural social unit; built-in virality.
3. **Busy households / repeat lunch buyers** — reliability and speed matter;
   highest retention.
4. **Diaspora payers (UK/EU)** — pay in GBP/EUR for family in Bandal;
   premium basket, no cash risk. *Later — has its own WhatsApp line (+44).* 

### 2.2 Supply — supplier segments
1. **Restaurants (3–5 at launch, target 15 by day 90)** — must be inside
   Bandal, have one Android + WhatsApp, and a signature dish that travels.
2. **Wewas (5–8 at launch, target 20+)** — own moto, any phone with
   WhatsApp, know Bandal by landmarks.

---

## 3. Sourcing suppliers (the supply side comes first)

**Restaurants — how to source, in order of speed:**
- **Start from the Groupe JNN / Tunakula existing partner pipeline** — the
  fastest yes; they already know the brand.
- **Walk Bandal's main food streets** — sign the 5 busiest with the pitch:
  *"Keep 100% of your menu price. One Android. We bring you new customers."*
  (vs Glovo's 25–35% cut — that line closes deals.)
- **Selection criteria:** open ≥ 6 days, a dish that survives 20 min in a
  bag (grilled/fried/stews > salads), owner reachable on WhatsApp, willing
  to run the accept/ready buttons.
- **Onboarding (30 min each):** confirm WhatsApp number, rehearse the
  order-card flow, agree prep times, print the bag tags. (See
  `docs/SATURDAY_LAUNCH_RUNBOOK.md`.)

**Wewas — how to source:**
- Recruit from existing Bandal moto stands and the Tunakula driver
  testimonials network (the 70% split is the hook — "your fee is 100%
  yours, paid immediately").
- **Selection:** owns/controls a moto, knows Bandal quartiers, has a float
  for change, passes a reference check.
- **Onboarding:** dispatch flow, 3-digit pickup code (anti-theft), daily
  float reconciliation at the agent point by 18h.

**Supply target before opening demand:** ≥ 3 restaurants + ≥ 5 wewas live
and rehearsed. Never advertise to customers before supply can serve them.

---

## 4. Getting the first 100 customers (30-day sprint)

The channel is the manual WhatsApp line (`wa.me/447493216101` → move to a
local +243 line for customer-facing use; see §8 note). Tactics, in the
order that compounds:

1. **Restaurant-seeded (fastest 30):** each of the 3–5 pilot restaurants
   posts the Tunakula WhatsApp link/QR to *their own* regulars ("commande
   chez nous sur WhatsApp, livré chaud"). Their existing demand = your
   day-one customers at zero CAC.
2. **QR posters (in-store + street):** at each restaurant counter and on
   Bandal's busy corners. QR → `wa.me` prefilled with "Nakolia".
3. **Bandal WhatsApp groups (next 30):** seed 3–5 quartier/church/office
   groups with the launch offer. This is where squad orders start.
4. **The referral loop (compounding 40+):** every delivered order closes
   with the customer's code — refer a friend, both get Crédit Tunakula,
   rewarded only on the friend's real paid first order (abuse-proof, in
   `@nzela/acquisition`). This is the #1 organic channel in a community
   market.
5. **First-order incentive:** livraison offerte or a small credit on order
   #1, funded from the service fee — removes first-try friction.
6. **Founder/ops hustle:** the team places and photographs the first
   real orders; every happy delivery becomes a WhatsApp Status + group post.

**Measure the leak daily** with `analyseFunnel()` (reach → start → confirm →
pay → deliver) and fix the worst stage first. Track the viral k-factor;
k ≥ 1 means growth self-sustains.

---

## 5. Marketing plan — engage marketwaros.com as execution partner

**Recommendation: appoint [marketwaros.com](https://www.marketwaros.com/)
as Tunakula's marketing-execution partner** to own the paid + organic
demand-generation workstreams below, so the internal team stays focused on
operations (supply, delivery, payments). Give them these concrete briefs:

| Workstream | Deliverable | Owner |
|---|---|---|
| Brand & launch creative | Launch visuals, posters, QR assets, WhatsApp Status pack (reuse the NZELA identity: nuit/wax/gold) | marketwaros.com |
| Social (FB/IG/TikTok) | Weekly content calendar of dishes + offers, best-time posting (data from the Growth Engine) | marketwaros.com |
| Paid acquisition (later) | Geo-targeted Bandal ads once organic proves conversion; strict cost-per-order target (§7) | marketwaros.com |
| Influencer / community | Bandal micro-influencers & food pages; squad-order seeding | marketwaros.com + ops |
| Diaspora campaign (Phase 3) | UK/EU Congolese community, the +44 line, "London pays, Kin eats" | marketwaros.com |

**Owned channels already built (hand these to marketwaros.com to amplify):**
- **SEO blog** — 12 feature posts, engine-linked, deploy-ready
  (`frontend/blog`, `wa.me/447493216101`). Submit sitemap to Search Console.
- **Weekly newsletter** — `@nzela/newsletter`, consent + unsubscribe, links
  every feature to the blog.
- **Partner Growth Engine** — restaurants generate their own posts/adverts,
  bringing their audiences at zero CAC.

**Hard rule for all paid marketing:** no channel scales past a proven
cost-per-order that keeps the ×2 rule intact (§7). marketwaros.com reports
cost-per-order weekly; underperforming channels are cut, not subsidised
(the discipline that killed Jumia Food's competitors is our default).

---

## 6. The 30 / 60 / 90-day plan

### Days 0–30 — LAUNCH & PROVE (Bandal)
- **Supply:** 3–5 restaurants + 5–8 wewas signed, onboarded, rehearsed.
- **Channel:** manual WhatsApp line live; landing page + blog hosted;
  marketwaros.com launch creative shipped.
- **Demand:** restaurant-seeding + QR + Bandal groups + referral loop on
  from order #1; first-order incentive live.
- **Targets:** **100 paying customers**, ≥ 85% order completion, payment
  auto/verified ≤ 30 s, every exception rescued (reroute/credit).
- **Prove:** ≥ ×2 profit per order on real orders (see §7).

### Days 31–60 — TIGHTEN & GROW
- **Supply:** grow to ~10 restaurants; fill cuisine gaps the coverage data
  shows; add wewas to hold offer-acceptance < 45 s.
- **Ops:** wire the automated bot behind the manual line (WhatsApp Cloud
  API templates, StackFood tokens, Lipa Box) — replace the operator with
  zero customer-visible change once one real paid order runs end-to-end.
- **Demand:** turn on the newsletter cadence; marketwaros.com starts small
  geo-targeted paid tests against a strict cost-per-order cap.
- **Targets:** **500+ monthly orders** (past the momo break-even of ~845/mo
  is the goal by day 90), k-factor rising, repeat rate ≥ 30%.

### Days 61–90 — SCALE THE MODEL
- **Supply:** ~15 restaurants; begin the second quartier only when Bandal
  density is proven.
- **Product:** Adresse Vocale + Commande voice agents live (LLM keys wired,
  ACU-gated); Crédit Tunakula refunds instant.
- **Demand:** SEO compounding; referral k-factor ≥ 1 target; squad orders a
  named channel; diaspora (+44) pilot with marketwaros.com.
- **Targets:** **≥ 845 orders/month** (momo break-even → every order at
  ×2), CAC below the service-fee headroom, churn controlled via win-back.

---

## 7. Economics & targets (the numbers that gate every decision)

Reference basket (locked, §8): food **17 000 FC** → customer pays
**22 540 FC** (~$8.05) → **Tunakula margin 3 090 FC (~$1.10)**; wewa gets
70% of delivery (2 450 FC), paid immediately.

- **Profit rule (enforced in code):** every order must clear **≥ ×2 all-in
  cost** — AI + WhatsApp + payment-rail fees + amortised Firebase/GCP/
  numbers/devices. (`shared/ledger/economics.ts`.)
- **Break-even volume for the ×2 rule:** **631 cash orders/month (~21/day)**
  or **845 mobile-money orders/month (~29/day).** Below that, fixed costs
  dominate — so **volume in Bandal is the whole month-1 job.**
- **AI cost ceiling:** ≤ $0.05/order; deterministic spine keeps 80–90% of
  interactions at $0; no AI action runs without ACU cover.
- **Card caveat (open decision):** card can't meet ×2 at the reference
  basket — reserve it for diaspora premium or surcharge the gateway fee.

**North-star KPIs:** paying customers, orders/day, order-completion %,
cost-per-order by channel, referral k-factor, repeat rate, ×2-rule pass %.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| No supply density → cold food, bad first impression | 5 km rule + sign restaurants BEFORE advertising |
| Launch line is a UK (+44) number for Kinshasa customers | Use a local **+243** line for customer-facing WhatsApp; keep +44 for diaspora/admin (**decision needed**) |
| Payment disputes / "did you get my money?" | SMS Ledger Bridge auto-match ≤ 30 s + proactive messaging; replay protection |
| Restaurant unreachable mid-order | Exception ladder: escalation → reroute or 40-second credit refund |
| Paid marketing burns cash (the Jumia trap) | Every channel gated on cost-per-order ≤ service-fee headroom; cut losers weekly |
| Fake-account/referral farming | Rewards only on real paid first orders + humans-only gate |

---

## 9. The ask / immediate next steps (this week)

1. **Confirm the customer-facing number** (+243 local vs the +44 line).
2. **Sign the first 3–5 Bandal restaurants** + 5–8 wewas (supply gate).
3. **Host** the landing page + blog; submit the sitemap.
4. **Brief marketwaros.com** on the §5 workstreams; ship launch creative.
5. **Go live** on the manual channel (`docs/SATURDAY_LAUNCH_RUNBOOK.md`);
   turn on the referral loop + first-order incentive from order #1.

*Tokoli malamu. Nzela ezali polele.*
