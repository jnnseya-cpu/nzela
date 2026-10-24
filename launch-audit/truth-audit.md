# Truth Audit — do the public claims match the code? (2026-10-24)

Method: every headline claim on the landing page + blog traced to its real code
path. Status ∈ REAL · PARTIAL · STUBBED · ABSENT · BROKEN. "LIVE?" = whether it
can run against real customers today (all are **No** — nothing is deployed).

| # | Public claim | Code status | LIVE? | Note |
|---|---|---|---|---|
| 1 | Order on WhatsApp, no app (numbered flow) | **REAL** | No | `ConversationEngine` + StackFood ports; integration- and live-boot-tested (mock transport) |
| 2 | **"Commander à la voix" in lingala/français** (headline blog post + hero "envoie un vocal") | **STUBBED / ABSENT** | No | The LLM voice-transcription + extraction agent is **contracts only** (`backend/agents` = interfaces, Phase 2). The deterministic text/numbered flow works; **voice ordering does not exist yet.** |
| 3 | Mobile money "confirmé automatiquement en ~30 s" | **PARTIAL** | No | Parsers + matcher + replay guard are REAL and tested; auto-confirm needs the Lipa Box hardware + merchant SIMs (not built/provisioned) — operational, not code |
| 4 | Cash at door · 3-digit pickup code · refund 40 s (Crédit Tunakula) · 0% commission · wewa 70% · 5 km rule / 3 km rain · landmark address · live order tracking | **REAL (in code/model)** | No | pricing, recap, `StackFoodCreditIssuer`, radius gates, landmark graph, milestone mapping all present + unit-tested; none exercised against live StackFood |
| 5 | **"On vient d'ouvrir / La nzela est ouverte / Commander maintenant"** | **BROKEN as stated** | No | Nothing is live and the CTA points to a **+44** line. The site presents a live, open service that does not yet exist — the single biggest fitness-for-purpose defect |
| 6 | Testimonials / reviews | **REAL (honest)** | — | Fake reviews already removed; replaced with an honest "100 premiers" founding offer |

## Truth-audit defects (must build, or remove the claim — never leave a promise unmet)
- **TA-1 (P1):** Voice ordering advertised as a headline but not implemented. Remedy: build the LLM voice agent (needs AI keys + work) **or** relabel the claim as "bientôt" until it exists. → human/business decision (`human-actions.md`).
- **TA-2 (P1):** Site reads as a live, open service while nothing is deployed and the number is +44. Remedy: launch, **or** reframe public surfaces to waitlist/"bientôt à Bandal". → business decision.
- **TA-3 (P2):** "Automatique en 30 s" mobile-money confirmation depends on un-provisioned Lipa Box hardware. Remedy: soften wording until the box is live, or provision it. → operational.

I did **not** unilaterally edit marketing copy — what to promise is the owner's
call. These are flagged, with the exact remedy, in `human-actions.md`.
