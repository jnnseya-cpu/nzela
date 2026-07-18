# NZELA-OS — Agentic AI Operating System for Tunakula-Congo
## Developer Requirements Document v1.0

**Owner:** Justin Nseya, Directeur Général, Groupe JNN / Tunakula-Congo
**System of record:** drc.tunakula.com (StackFood multi-restaurant platform)
**Pilot zone:** Bandalungwa (Bandal), Kinshasa, DRC
**Status:** Approved for build · Consolidates the NZELA-OS Blueprint, StackFood Integration Spec, and validated interactive prototype
**Reference prototype:** `tunakula-nzela-os-interactive.html` (jsdom-tested, zero JS errors — treat as the UX contract)

---

## 1. Executive Summary

NZELA-OS is a WhatsApp-native, agentic AI ordering and delivery operating system for Kinshasa. It adds a conversational channel on top of the existing StackFood platform (drc.tunakula.com), which remains the single system of record for restaurants, menus, prices, orders, and settlement.

The design premise: Uber Eats-style apps fail in Kinshasa because they assume app installs, GPS addresses, card payments, stable data, and drivers who navigate by map. NZELA-OS assumes the opposite: WhatsApp is already installed, addresses are landmarks, payment is cash or mobile-money SMS, data is expensive, and wewas (moto drivers) navigate by quartier knowledge.

The system is a **deterministic spine with an AI escalation ladder**: every step that can be a button, a state machine, or an algorithm costs zero tokens; LLM agents fire only where natural language genuinely adds value (free-text/voice ordering, landmark address extraction, disputes, one upsell), each with a hard per-call budget. Target blended AI cost: **≤ $0.05 per order** against a **~$1.10 per-order margin** (coverage ×22).

---

## 2. Scope

### 2.1 In scope (Phase 1–2)
1. WhatsApp customer channel: discovery, ordering (buttons + free text + voice), landmark addressing, payment confirmation, live status, rating, disputes.
2. WhatsApp restaurant channel: order accept/reject state machine, prep-time capture, ready signal, timeout escalation to automated voice call.
3. WhatsApp wewa channel: dispatch offers, pickup/delivery confirmations, milestone pings, cash float ledger.
4. SMS Ledger Bridge (Lipa Box): mobile-money confirmation without any operator API.
5. Full bidirectional StackFood integration (Flows 1–5, §9).
6. Ops ledger/console: per-order event log, AI spend meter, WhatsApp conversation-cost meter.
7. StackFood-mirrored home experience as the entry surface (per prototype).

### 2.2 Out of scope (later phases)
USSD feature-phone fallback (Phase 3); diaspora BitriPay checkout beyond the design stub (Phase 3); multi-city expansion; restaurant self-onboarding portal; native apps.

### 2.3 Success metrics (pilot exit criteria)
| Metric | Target |
|---|---|
| Order completion rate (started → delivered) | ≥ 85% |
| Median time, first message → confirmed order | ≤ 90 s |
| Blended AI cost per completed order | ≤ $0.05 |
| WhatsApp messaging cost per order | ≤ $0.024 |
| Payment auto-match rate (SMS Ledger Bridge) | ≥ 95% within 30 s |
| Orders rescued by exception ladder (resto unreachable) | ≥ 60% converted to reroute or credit |
| Delivery radius compliance | 100% of orders ≤ 5 km |

---

## 3. Product Principles (binding on all implementation decisions)

1. **StackFood is the system of record.** NZELA-OS never stores canonical menu, price, or order state. It reads, writes, and mirrors.
2. **Deterministic first.** If a step can be a button or a rule, it must never call an LLM.
3. **Token budgets are hard caps,** enforced in code per agent per order. Budget exhaustion degrades to buttons, never to failure.
4. **Every AI action is ledgered** (agent, purpose, cost, order ID) — the ops ledger in the prototype is a product requirement, not a demo flourish.
5. **Low data by design.** Customer-facing messages are text-first; media only when it converts (menu photos). Milestone pings ≤ 2 KB.
6. **The 5 km rule is inviolable** and enforced at three gates (§6.3).
7. **French UI, Lingala-friendly tone.** Mama Tunakula's voice: warm, brief, Kinois. All customer strings reviewed by a native speaker before launch.

---

## 4. Actors & Channels

| Actor | Channel | Identity |
|---|---|---|
| Customer | WhatsApp (Cloud API) | E.164 wa_id → auto-provisioned StackFood customer account |
| Restaurant | WhatsApp + escalation voice call (TTS) | Service account per restaurant, mapped to StackFood vendor ID |
| Wewa (driver) | WhatsApp | Service account mapped to StackFood delivery-man ID |
| Diaspora payer | Web link (BitriPay) — Phase 3 | BitriPay wallet → Crédit Tunakula |
| Ops team | NZELA console (web) | Admin SSO |

---

## 5. Agent Registry (8 agents — hard budgets)

| # | Agent | Type | Budget/call | Role |
|---|---|---|---|---|
| 1 | NZELA Router | Deterministic | $0 | Keyword/button routing, session state, **AI firewall** (off-topic → canned redirect, zero tokens, logged) |
| 2 | Commande Agent | LLM-small | $0.005 | Free text/voice note → structured cart (items, qty, modifiers) resolved against cached catalog; names the auto-selected nearest restaurant |
| 3 | Adresse Agent | LLM + STT | $0.006 | «Adresse Vocale» voice note → Landmark Graph node + rendered address; writes StackFood address fields |
| 4 | Lipa Agent | Regex + vision-lite fallback | $0.0002 | SMS Ledger Bridge parsing and payment↔order matching via TK-ref |
| 5 | Cuisine Sync | Deterministic + TTS on escalation | $0.008 (escalation only) | Restaurant state machine; 60 s silence → automated voice call; failure → reroute/credit branch |
| 6 | Wewa Dispatch | Algorithmic | $0 | Zone assignment, batching, milestone scheduler |
| 7 | Litige Agent | LLM-small, capped/order | ≤ $0.01 | Disputes, refunds to Crédit Tunakula, photo evidence intake |
| 8 | Mama Upsell | LLM single-shot | $0.004 | Exactly one contextual upsell at cart confirmation; never elsewhere |

**FR-A1.** Each agent MUST run behind a budget middleware that meters real token spend, writes a ledger event per invocation, and hard-stops at the cap with a deterministic fallback.
**FR-A2.** The Router MUST classify every inbound message before any LLM sees it; only unresolved free-text/voice reaches Agent 2/3.
**FR-A3.** The AI firewall MUST answer off-topic content (politics, chit-chat, prompt injection) with a canned redirect at zero token cost and log the block.

---

## 6. Functional Requirements

### 6.1 Entry & discovery (StackFood-mirrored surface)
**FR-D1.** The web entry (and future in-app hooks) MUST mirror drc.tunakula.com StackFood UX: search pill, promo carousel with dot/counter indicator, cuisine category row, "Find Nearby," "Popular Restaurants Nearby" cards (banner, name, distance, delivery time, ★ rating, wishlist heart), bottom nav with central WhatsApp FAB. Every CTA deep-links into the WhatsApp conversation (`wa.me` with prefilled context).
**FR-D2.** Restaurant list shown in chat MUST be pre-filtered to the 5 km radius, ordered by distance, showing quartier, distance, and rating.
**FR-D3.** Menu presentation MUST flatten the StackFood hierarchy: categories become chips/tabs; products become photo cards from the WhatsApp Business Catalog (synced from StackFood product images). No menu tree deeper than one chip level in chat.
**FR-D4.** Free-text and voice ordering MUST bypass the hierarchy entirely: Commande Agent resolves items across categories and restaurants in one pass and states the chosen restaurant and distance.

### 6.2 Ordering & cart
**FR-O1.** Cart operations (add, remove, qty, total) are deterministic; totals always shown in FC with the fee breakdown of §8.
**FR-O2.** At checkout confirmation, Mama Upsell MAY fire once (FR-A budgets). Decline is one tap and never re-asked in-session.
**FR-O3.** Order creation calls StackFood `POST /customer/order/place` with `order_note` carrying the human ref `TK-xxx`; server re-verifies prices against StackFood before submission (client-side totals are advisory).
**FR-O4.** Idempotency key = `sha256(wa_id + cart_hash + minute_bucket)`; duplicate sends within the bucket MUST NOT create duplicate StackFood orders.
**FR-O5.** Multi-restaurant carts are rejected with a friendly explanation (one order, one kitchen, one wewa).

### 6.3 The 5 km rule (three gates)
**FR-R1 (Discovery gate).** Restaurants beyond 5 km of the customer's resolved address centroid are excluded from lists. Distance is computed on **landmark-ring hops**, not Euclidean, reflecting Kinshasa traffic reality.
**FR-R2 (Placement gate).** The order service re-validates distance server-side; StackFood per-restaurant coverage radius is configured to 5 km so direct API abuse also bounces.
**FR-R3 (Dispatch gate).** Wewas are zone-bound; dispatch never offers a course crossing the radius.
**FR-R4.** A blocked selection MUST return a warm refusal explaining the rule (hot food + traffic) **plus a category-matched substitute within radius** — the rule must convert, not just deny.
**FR-R5.** Rain mode: a global toggle (ops console, later weather-API-driven) shrinks the radius to 3 km and applies the rain delivery-fee multiplier.
**FR-R6.** Coverage analytics: the console MUST chart cuisine-category gaps per quartier within the radius map, to drive partner recruitment.

### 6.4 Addressing — Landmark Graph & Adresse Vocale
**FR-L1.** Addresses are landmark expressions («Bandal, après le marché, portail vert en face de la pharmacie Mère Teresa»), stored as graph nodes (quartier → avenue → landmark → micro-cue) with a centroid lat/lng.
**FR-L2.** Adresse Vocale: a voice note is transcribed and parsed by Adresse Agent into graph nodes; customer confirms with one tap; result is written to the StackFood address fields with the centroid as lat/lng.
**FR-L3.** Wewa-facing directions render as landmark chains, never raw coordinates; a map pin is attached only as a secondary aid.
**FR-L4.** Confirmed deliveries MUST strengthen the graph (successful landmark chains gain weight; new micro-cues are appended for reuse).

### 6.5 Payments
**FR-P1 (SMS Ledger Bridge / Lipa Box).** One dedicated merchant SIM per operator (M-Pesa, Orange Money, Airtel Money, Africell) in an Android Lipa Box running an SMS forwarder to the NZELA backend. Regex-first parse; vision-model fallback for forwarded screenshots. Customer includes `TK-xxx` in the payment reference; Lipa Agent auto-matches payment↔order in ≤ 30 s at ≥ 95% rate. No operator API contract required.
**FR-P2 (Cash).** Cash orders debit the assigned wewa's float ledger at pickup and settle on the 70/30 delivery split at cash-in; ledger visible to ops in real time.
**FR-P3 (Crédit Tunakula).** Instant refunds/credits are issued via the StackFood reconciliation pattern (Offline Payment method on StackFood ≥ v7, else wallet-credit bridge via admin API) and are spendable on the next order with zero friction.
**FR-P4.** Unmatched payments after 3 min escalate to Litige Agent, then ops, with the customer proactively informed — the customer never has to ask "did you get my money?"

### 6.6 Restaurant operations & exception ladder
**FR-K1.** New order → WhatsApp utility template to the restaurant with Accept / Reject / prep-time buttons; every button maps to StackFood vendor API state changes.
**FR-K2.** 60 s without response → Cuisine Sync places an automated TTS voice call (budget $0.008). Voice-call acceptance is captured by DTMF or callback button.
**FR-K3.** Full failure → customer instantly gets both branches: reroute to the nearest category-matched restaurant **or** one-tap full refund to Crédit Tunakula. This exception path is a first-class flow with its own ledger events.
**FR-K4.** Restaurant "Plat PRÊT" triggers dispatch; late kitchens accrue a reliability score consumed by discovery ranking.

### 6.7 Dispatch, delivery & handoff
**FR-W1.** Dispatch is algorithmic (zone, float capacity, reliability, batching); offers expire in 45 s and cascade.
**FR-W2.** Customer receives milestone pings (accepted / cooking / wewa assigned / picked up / nearby / arrived), each ≤ 2 KB, sourced from wewa button taps and StackFood status webhooks.
**FR-W3.** Physical handoff uses the bag tag = order ref (`sac TK-347`); customer closes the loop with a one-tap «Bien reçu» which finalises cash settlement and unlocks rating.
**FR-W4.** Post-delivery: 5-star tap rating (writes to StackFood reviews), then a per-order bilan (items, fees, AI spend, messaging spend) in the ops ledger.

### 6.8 Status sync (bidirectional)
**FR-S1.** WhatsApp buttons → StackFood vendor/DM API calls (source of truth updated first, then messaging).
**FR-S2.** StackFood → NZELA via a custom Laravel `OrderObserver` webhook module (~120 lines, add-on package, **no core file edits**), HMAC-signed; 20 s polling fallback when webhooks are down.
**FR-S3.** A single mapping table governs StackFood status → customer milestone → template ID; it ships as config, not code.

---

## 7. WhatsApp Cloud API Requirements

**FR-M1.** Customer conversations are always customer-initiated → free service window; the system MUST keep the customer window open by design (buttons prompt replies) so customer-side messaging cost stays $0.
**FR-M2.** Paid utility templates are used only for cold pings to restaurants/wewas (~$0.008 each, Rest-of-Africa rate). Any button tap reopens their 24 h window; subsequent messages ride free. Budget: ≤ 3 paid templates per order worst case (≤ $0.024).
**FR-M3.** Six French utility templates are required for Meta approval before launch: (1) resto new-order, (2) resto reminder/escalation, (3) wewa dispatch offer, (4) customer payment-received, (5) customer wewa-assigned, (6) customer order-delivered/rating. Exact copy to be finalised from the prototype strings.
**FR-M4.** A per-order messaging-cost meter (waC/waP/waW classes as prototyped) writes to the ledger alongside AI spend.
**FR-M5.** Menu photos ship via the WhatsApp Business Catalog, batch-synced from StackFood product images (Flow 1), not as ad-hoc media uploads.

---

## 8. Order Economics (locked)

Example basket 17 000 FC (FC/USD ≈ 2 800):

| Line | FC | USD |
|---|---|---|
| Sous-total (food) | 17 000 | 6.07 |
| Frais de service 10% (customer pays) | 1 700 | 0.61 |
| Frais de traitement 2% (customer pays) | 340 | 0.12 |
| Livraison Zone 1 | 3 500 | 1.25 |
| **Total client** | **22 540** | **8.05** |
| Wewa (70% of delivery) | 2 450 | 0.875 |
| **Marge Tunakula** (service + traitement + 30% livraison) | **3 090** | **1.10** |

Delivery zones: Zone 1 (same quartier, ≤ 3 landmark hops) 3 500 FC · Zone 2 (adjacent quartier/same commune) 5 000 FC · Zone 3 (cross-commune, still ≤ 5 km) 7 000+ FC. Zone charges and the 70/30 DM commission are configured natively in StackFood admin; rain/night multipliers configured there too.

**FR-E1.** The fee model is client-pays (per the redesigned partner contract): restaurants are never charged the service/processing fees.
**FR-E2.** Every customer-facing total MUST show the full breakdown before payment; no hidden fees.

---

## 9. StackFood Integration (summary of the binding spec)

The full engineering detail lives in `NZELA_StackFood_Integration_Spec.md`; headline requirements:

1. **Flow 1 — Catalog pull:** `/restaurants/get-restaurants`, `/products/latest`, `/products/search`; Redis cache TTLs 15 min (products), 10 min (restaurants), 60 min (config); photo batch-sync to WhatsApp Catalog.
2. **Flow 2 — Address write:** Adresse Vocale output → StackFood address fields, centroid lat/lng, DM pin-confirmation patch.
3. **Flow 3 — Order placement:** full `POST /customer/order/place` payload, `order_note: "TK-xxx"` join key, server-side price re-verification, idempotency per FR-O4.
4. **Flow 4 — Payment reconciliation:** Offline-Payment pattern (v7+) or wallet-credit bridge; both enable instant Crédit Tunakula.
5. **Flow 5 — Status sync:** observer webhook module + polling fallback + config mapping table (FR-S1–S3).

Auth: per-customer StackFood accounts auto-provisioned from wa_id; tokens in Redis; service accounts per restaurant and wewa.

---

## 10. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Latency | Bot reply ≤ 2 s p95 (deterministic paths); LLM paths ≤ 5 s p95 |
| StackFood client | 5 s connect / 10 s read timeouts; 3× exponential backoff; ≤ 10 req/s budget |
| Resilience | Postgres **outbox** for all StackFood writes; queued and replayed through StackFood downtime; customer flow degrades gracefully (order accepted, sync deferred) |
| Security | HMAC-signed webhooks; PII encrypted at rest; admin routes IP-allowlisted; least-privilege service accounts |
| Privacy | wa_id is the customer key; no data resale; deletion on request; DRC + UK GDPR posture consistent with Groupe JNN policy |
| Observability | Structured event ledger per order (the prototype's Registre is the spec); AI + messaging cost meters; alerting on payment-match rate < 95% and escalation-ladder volume spikes |
| Language | All customer strings in French (Kinois register); code/comments in English |

---

## 11. Technical Stack & Repo Conventions (Groupe JNN standard)

- **Backend:** NestJS (TypeScript), PostgreSQL, Redis, Kafka (event bus for order/ledger events), LangGraph for agents 2, 3, 7, 8.
- **Frontend surfaces:** Next.js 14 (ops console + entry page mirroring StackFood UX); the validated prototype HTML is the UX contract.
- **Messaging:** WhatsApp Cloud API (Meta-hosted); TTS voice escalation via cloud telephony provider (Twilio-class, DRC routes verified).
- **Lipa Box:** Android SMS-forwarder app (Kotlin or off-the-shelf forwarder + hardening) → HTTPS ingest endpoint.
- **StackFood side:** one Laravel add-on package (OrderObserver webhook), zero core edits, survives StackFood upgrades.
- **Infra:** GCP; IaC; staging mirrors production including a StackFood staging instance.
- **Billing convention:** AI usage metered internally in **ACU** per the portfolio-wide model (3× multiplier law applies to resale contexts).
- **Monorepo:** `apps/gateway` (WhatsApp webhook + router), `apps/agents`, `apps/ops-console`, `apps/lipa-ingest`, `packages/stackfood-client`, `packages/landmark-graph`, `packages/ledger`.

---

## 12. Delivery Plan

**Phase 0 — Foundations (Wk 1–2):** WhatsApp Cloud API onboarding + template submission (FR-M3); StackFood client package + auth provisioning; ledger schema; Router + firewall.
**Phase 1 — Order loop (Wk 3–5):** Flows 1 & 3; button ordering end-to-end on staging; restaurant channel + state machine; wewa dispatch + milestones; 5 km gates.
**Phase 2 — Money & language (Wk 6–8):** Lipa Box + Flow 4; cash float ledger; Commande + Adresse agents; exception ladder incl. TTS call; Mama Upsell; Litige.
**Phase 3 — Pilot hardening (Wk 9–10):** Outbox/resilience drills; cost meters + alerting; native-speaker string review; Bandal soft launch with 3–5 restaurants and 5–8 wewas.
**Phase 4 — Post-pilot:** BitriPay diaspora checkout, USSD fallback, rain-mode automation, multi-quartier expansion driven by FR-R6 gap analytics.

---

## 13. Acceptance Criteria (pilot gate)

1. End-to-end order (discovery → delivery → rating) completes on production StackFood with all three actors on real WhatsApp numbers, order visible in the StackFood admin identically to a web order.
2. 5 km rule demonstrably enforced at all three gates, including the polite-substitution response.
3. Mobile-money payment auto-matched from a real operator SMS in ≤ 30 s; cash order settles the 70/30 split correctly in the float ledger.
4. Restaurant silence triggers the voice-call escalation and, on failure, both reroute and instant-credit branches work.
5. Ledger shows per-order AI spend ≤ $0.05 and messaging spend ≤ $0.024 across a 20-order test batch.
6. StackFood downtime drill: orders queue in the outbox and replay cleanly; customers see no failure.
7. All six Meta templates approved; firewall blocks off-topic probes at zero token cost.

---

## 14. Open Items

1. **Production catalog import** — awaiting `api/v1/config` + restaurant JSON export from drc.tunakula.com to replace demo data (restaurants, menus, prices, photo URLs).
2. Final French template copy (from prototype strings) formatted for Meta submission.
3. Laravel OrderObserver module code (~120 lines) — specified, to be written against the exact StackFood version.
4. Telephony provider selection for TTS escalation calls into DRC networks.
5. BitriPay diaspora checkout UX (Phase 4 design).
6. Partner-contract annex wording for the delivery-fee zone table (French, aligned to the redesigned client-pays contract).

---

*NZELA-OS v1.0 — Groupe JNN · Tunakula-Congo · Prepared for engineering handoff. The interactive prototype is the authoritative UX reference; where this document and the prototype diverge, flag for product decision rather than assuming.*
