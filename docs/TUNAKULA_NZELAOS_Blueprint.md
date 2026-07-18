# TUNAKULA NZELA-OS
## The WhatsApp-Native, Cash-First, AI-Governed Food Delivery Operating System for Kinshasa
**Groupe JNN — Tunakula CD | Confidential Working Blueprint v1.0**

---

## 1. The Thesis: Why Uber Eats Dies in Kinshasa — and What Replaces It

Uber Eats assumes five things Kinshasa does not have: smartphones with free storage, cheap always-on data, card rails, GPS street addressing, and consumers willing to install an app to eat. Every clone that imports these assumptions burns capital subsidising a behaviour the city will never adopt.

NZELA-OS inverts every assumption:

| Uber Eats assumption | Kinshasa reality | NZELA-OS answer |
|---|---|---|
| Native app | WhatsApp is the internet | **WhatsApp IS the app** — zero install, zero storage |
| Card payments | Cash + mobile money wallets, no usable APIs | **SMS Ledger Bridge** (API-free reconciliation) + cash-on-delivery float system |
| GPS addresses | "Après l'église, portail bleu" | **Landmark Graph** + voice-note addressing in Lingala/French |
| Live map tracking | Data costs money | **Milestone tracking** — 5 status pings, ~2KB total |
| AI everywhere | AI tokens cost hard USD | **Deterministic-first architecture** — AI fires only where it earns |

The product principle: **the customer never leaves WhatsApp, the restaurant never needs more than one cheap Android, the driver never needs an app, and the AI never spends a token it can't justify.**

---

## 2. Core Architecture: The Deterministic Spine + AI Escalation Ladder

The single biggest cost trap in "agentic" commerce is letting an LLM handle every message. NZELA-OS runs on a **deterministic state machine spine** — WhatsApp interactive lists, buttons, and templates that cost zero AI tokens — and escalates to AI only at four defined moments.

### 2.1 The Spine (0 tokens, ~80–90% of all interactions)

```
Customer: "Nakolia" / "menu" / taps saved link
  → WhatsApp List: [Restaurants near your saved zone]
  → List: [Menu categories] → [Items] → [Quantity buttons]
  → Order summary + total (fees shown transparently, client-pays model)
  → Button: [Confirmer] [Modifier] [Annuler]
  → Payment options: [Cash à la livraison] [Mobile Money] [Crédit Tunakula]
  → Milestone notifications (templates): Acceptée → En cuisine → Wewa en route → Arrivé
```

Every step above is button-driven. No LLM. WhatsApp conversation cost only (~$0.01–0.03 per 24h session at DRC utility rates).

### 2.2 The AI Escalation Ladder (tokens spent only here)

| Trigger | Agent | Model class | Why it earns its cost |
|---|---|---|---|
| Free-text or voice-note order ("2 poulets mayo chez Mama Kito, pas de piment") | Commande Agent | Small/fast | Converts intent → structured order; directly revenue-linked |
| Address in prose or voice ("Bandal, après le rond-point, portail vert") | Adresse Agent | Small + speech-to-text | Solves the #1 delivery failure cause; saved forever after first resolution |
| Payment proof (screenshot / forwarded SMS) | Lipa Agent | Vision-lite / regex-first | Replaces the mobile money API entirely |
| Complaint or dispute | Litige Agent | Small | Retention; capped tokens per case |
| Confirmation moment | Mama Upsell Agent | Small, single-shot | One contextual upsell line ("Ajouter un jus de gingembre, 2 000 FC?") — highest ROI token in the system |

**AI Firewall rules (non-negotiable):** per-session token budget; regex/keyword routing before any LLM call; aggressive prompt caching of menus and FAQs; small-model default with zero large-model calls in the order path; browsing/chat without order intent is throttled to the deterministic spine after a fixed free budget. A curious user costs you ≤ $0.01. A converting user costs ≤ $0.05 and pays you $0.80+.

---

## 3. The Three Kinshasa-Native Inventions

### 3.1 The SMS Ledger Bridge — mobile money without a single API

The insight: **every mobile money payment in DRC generates a confirmation SMS.** You don't need M-Pesa's API — you need to read your own inbox.

- Tunakula holds one merchant SIM per operator (M-Pesa, Orange Money, Airtel Money, Africell) in a supervised Android device ("Lipa Box") running an SMS forwarder.
- Customer pays the Tunakula merchant number and puts their **3-digit order code** in the reference (or sends the screenshot on WhatsApp if they forget).
- Every confirmation SMS is auto-forwarded to the backend. Lipa Agent parses amount + sender + code (regex first, AI vision only for screenshots), matches it to the open order, and flips the order state to PAID in under 30 seconds.
- Restaurants are settled weekly, net of the client-side fees — consistent with the redesigned partner contract (10% service + up to 2% processing charged to the customer, never the restaurant).

**Strategic by-product: float.** Money sits in Tunakula wallets between collection and settlement. This is BitriPay's natural on-ramp in the DRC — the delivery business becomes the payment business's customer acquisition engine.

### 3.2 The Landmark Graph — addressing a city with no addresses

Kinshasa navigates by landmarks, not streets. NZELA-OS treats this as data, not a problem.

- First order: customer sends a voice note or text describing their location. Adresse Agent extracts commune → quartier → landmark chain → door descriptor, and asks the driver to confirm the pin on successful delivery.
- That confirmed location becomes a permanent **Adresse Vocale** — a reusable, structured address object. Second order onward: zero AI cost, one-tap reorder to "Chez moi (Bandal, après Sainte-Anne)".
- Every delivery enriches a proprietary landmark graph of Kinshasa, commune by commune. Within 12 months this dataset is a moat no Uber clone can buy — and it's licensable (logistics, e-commerce, emergency services).

### 3.3 Diaspora Orders — the London-pays, Kinshasa-eats loop

The highest-margin customer for Kinshasa food delivery doesn't live in Kinshasa. A family member in the UK/EU orders dinner for parents in Bandal and pays in GBP via **BitriPay** — card rails exist on their side. No mobile money problem, no cash risk, premium basket sizes, and it directly feeds the UK/EU → DRC remittance corridor BitriPay is built for. This is a feature no competitor can replicate without building a licensed remittance rail first.

**Supporting rails:** *Crédit Tunakula* — prepaid credit sold for cash through kiosk/airtime agents (code-based, redeemed in WhatsApp), turning the informal agent network into your top-up infrastructure; and squad orders — office/church WhatsApp groups place one pooled order with one delivery, collected in cash by the group organiser (Kinshasa's natural social unit doing your payment aggregation for free).

---

## 4. Order Lifecycle Synchronisation (End-to-End, App-Free)

| Stage | Restaurant side | Driver (wewa) side | Customer side | AI/token cost |
|---|---|---|---|---|
| 1. Order placed | Structured WhatsApp message with buttons **[Accepter — prêt en 15/25/40 min] [Refuser: rupture]** | — | "Commande envoyée" template | 0 (or Commande Agent if free-text) |
| 2. Accepted | Timer starts; auto-reminder at T-5 | Dispatch algorithm (zone + batching, pure code, no LLM) pings 1–3 nearest wewas: **[Je prends]** | "Acceptée — prête vers 19:40" | 0 |
| 3. In kitchen | Taps **[Prêt]** | Wewa gets pickup card: restaurant, code, cash amount if COD | "En cuisine" | 0 |
| 4. Pickup | Shows 3-digit code match | Taps **[Récupéré]** after code match (anti-theft) | "Ton wewa est en route" + driver name/moto plate | 0 |
| 5. Delivery | — | Taps **[Livré]**; COD: confirms amount collected | "Arrivé!" + rating buttons ★ | 0 |
| 6. Exceptions | Late/no-response → Cuisine Sync Agent calls restaurant via voice template | Dispute → Litige Agent | Refund → Crédit Tunakula (instant, no money movement) | AI only here |

Restaurant hardware requirement: **one Android phone with WhatsApp.** Driver requirement: **any phone with WhatsApp.** Total sync cost per clean order: 6–8 template messages, zero tokens.

Cash discipline: each wewa carries a capped float, reconciles daily at agent points; a running WhatsApp ledger per driver (auto-generated, deterministic) shows cash owed in real time. Trust score gates order value per driver.

---

## 5. AI Cost Recovery Model — Making the Tokens Pay Rent

**Cost side (per order, blended target):**

| Component | Cost |
|---|---|
| WhatsApp session (utility pricing, DRC) | $0.010–0.030 |
| LLM calls (order parsing + upsell, small model, cached menus) | $0.003–0.008 |
| Voice transcription (30% of orders, ~30 sec) | $0.003 |
| Payment verification (regex 85% / vision 15%) | $0.001 |
| Non-converting session overhead (amortised, budget-capped) | $0.005 |
| **Blended AI + messaging cost per delivered order** | **≤ $0.05** |

**Recovery side (per order, avg basket $8–12):**

| Stream | Value |
|---|---|
| Client service fee 10% (client-pays model, per redesigned contract) | $0.80–1.20 |
| Payment processing pass-through (up to 2%) | $0.16–0.24 |
| Upsell attach (Mama Upsell, 15% attach × $1.50 avg) | $0.22 |
| **Revenue per order vs AI cost** | **~20–30× coverage** |

**Recovery beyond orders — because not every session converts:**

1. **Restaurant SaaS (Tunakula Pro):** AI menu digitisation from a photo, weekly demand forecast, WhatsApp storefront page — flat monthly fee in FC. The restaurant pays for AI value even in weeks with few orders.
2. **Sponsored placement** in the restaurant list (deterministic to serve — pure margin).
3. **Float yield** on the SMS Ledger Bridge settlement cycle (BitriPay).
4. **Diaspora premium** — FX margin + convenience fee on GBP/EUR-funded orders.
5. **Landmark Graph licensing** (Phase 3 asset).

**Governance metric:** *AI Cost per Delivered Order (ACDO)* reported weekly, with a hard ceiling; any agent whose token spend can't be traced to conversion, retention, or a paid SaaS feature gets demoted to a deterministic flow. This is the ACU discipline applied operationally.

---

## 6. Lean Agent Registry (8 agents — every one earns or it goes)

| # | Agent | Type | Function |
|---|---|---|---|
| 1 | NZELA Router | Deterministic | Keyword/button intent routing; the AI firewall gatekeeper |
| 2 | Commande | LLM (small) | Free-text/voice order → structured order object |
| 3 | Adresse | LLM + STT | Landmark extraction, Adresse Vocale creation, Landmark Graph enrichment |
| 4 | Lipa | Regex + vision-lite | SMS Ledger Bridge parsing, screenshot verification, settlement ledger |
| 5 | Cuisine Sync | Deterministic + voice template | Restaurant state machine, timers, escalation calls |
| 6 | Wewa Dispatch | Algorithmic | Zone assignment, batching, traffic-window pre-orders (Kin embouteillage mode) |
| 7 | Litige | LLM (small, capped) | Disputes, refunds to Crédit Tunakula |
| 8 | Mama Upsell | LLM (single-shot) | One contextual upsell at confirmation, Lingala/French persona voice |

Persona note: the system speaks as **"Mama Tunakula"** — warm market-auntie register, Lingala-French code-switching, voice-note friendly. Personality is a retention asset that costs nothing extra to run.

---

## 7. Phased Rollout

**Phase 0 — Pilot (Weeks 1–8):** One commune (Bandal or Gombe), 15–20 restaurants from the existing partner pipeline, 25 wewas, cash-on-delivery only + Crédit Tunakula. Deterministic spine + Commande/Adresse agents. Target: ACDO ≤ $0.05, delivery success ≥ 92%.

**Phase 1 — Lipa Box (Weeks 8–16):** SMS Ledger Bridge live on M-Pesa + Orange Money. Restaurant SaaS beta (menu digitisation). Squad orders.

**Phase 2 — Diaspora (Months 4–6):** BitriPay GBP/EUR-funded orders, UK Congolese community launch (Birmingham network as beachhead). Landmark Graph covers 5 communes.

**Phase 3 — Scale & Moat (Months 6–12):** USSD fallback for feature phones (menu-of-the-day, limited SKUs), second city assessment (Lubumbashi), Landmark Graph licensing conversations, full BCC-aligned settlement architecture as BitriPay licensing matures.

---

## 8. Why This Wins

Every competitor will fight for the 5% of Kinshasa that behaves like Lagos Island or Nairobi's Westlands. NZELA-OS is built for the 95%: WhatsApp-only, cash-carrying, landmark-navigating, voice-note-sending Kinois — served by an AI system disciplined enough to spend tokens like they're dollars, because they are. The delivery margin funds the platform; the payment float funds BitriPay; the landmark data funds the future.

*Tokoli malamu. Nzela ezali polele.*
