# GO-LIVE READINESS — certified the night before

**Verdict, stated plainly:**

- **GO tomorrow morning:** public launch of the WhatsApp channel in
  **manual mode** (operator + WhatsApp Business App + cd.tunakula.com +
  manual SIM verification) with the landing page live. Real customers,
  real payments full-cycle, real deliveries — on rails that already work.
- **NO-GO tomorrow for the automated bot**, and no code written tonight
  could change that: Meta Cloud API verification and template approval
  (external, 1–5 days), production hosting credentials, cd.tunakula.com
  API tokens, and physical merchant SIMs are all outside the codebase.
  Launching the bot without them isn't a risk — it's impossible.
  The manual channel makes this invisible to the public: same number,
  same scripts, same receipts. When the bot is ready it replaces the
  operator silently.

## Certified tonight (all green, evidence in repo)

| Suite | Result |
|---|---|
| Code: unit + integration (incl. mock-StackFood full loop) | **102 / 102 PASS** |
| UI campaign as real actors (momo, cash, exception runs) | **21 / 21 PASS** |
| Typecheck (strict) | clean |

## Deep-dive findings FIXED tonight (each now regression-tested)

1. **CRITICAL — NaN-amount fraud:** an SMS with a malformed amount
   («1,2,3 FC») parsed to NaN, and NaN defeats the amount-tolerance
   check — a crafted message could have VERIFIED a payment. Fixed at the
   parser (rejects non-finite/non-positive) AND the matcher (defense in
   depth, `invalid-amount` verdict).
2. **CRITICAL — sender spoofing:** operator wording texted to the
   merchant SIM from an ordinary phone number could parse as a
   confirmation. Fixed: senders that are subscriber numbers never parse;
   only operator shortcodes/alpha IDs do.
3. **HIGH — double-order race:** two concurrent taps could both pass the
   idempotency pre-check and place two real orders. Fixed with per-TK-ref
   in-flight deduplication; concurrent double-tap now provably produces
   exactly one POST.
4. Abuse sweep passed: 50k-char fuzz, emoji floods, SQL/script strings,
   prompt-injection attempts (all firewall-blocked at $0), malformed JSON
   on every endpoint (graceful errors, process survives), concurrent
   replay of the same SMS verifies exactly once, Meta's 200-on-ignored
   webhook contract respected.

## Morning runbook (manual-mode public launch)

**H-2 (before announcing):**
1. WhatsApp Business App live on the dedicated Android; greeting + quick
   replies loaded from `docs/LAUNCH_TOMORROW.md`.
2. Landing page deployed with the REAL number in both wa.me links.
3. Merchant SIM(s) in the ops room; paper TK-code register ruled (code ·
   amount · operator · time · checked = the human replay index).
4. Admin ready: pilot restaurant menus/prices/photos checked; zones and
   fees as configured.
5. **Full dress order by the team:** order → pay 1 000 FC by momo →
   verify SMS → enter in admin → deliver → receipt → rating. If this one
   order fails at any step, fix before announcing — never after.

**H-0:** announce (Status + groups + QR at restos). One operator on the
phone, one person on admin, Justin reachable.

**During the day — the four abort/rescue rules:**
- Payment SMS not found in 3 min → operator messages the customer FIRST,
  then investigates. Never silence.
- Restaurant unreachable 5 min → reroute or instant credit, per script.
- Any doubt on a payment → treat as unpaid, apologise, credit if wrong.
  Losing 22 540 FC is cheap; losing trust is not.
- Overload (queue > 10 conversations) → post «forte demande, réponse
  sous 15 min» status; never leave a message unanswered > 15 min.

**H+12 (tonight):** 3-way reconciliation (SIM inbox ↔ register ↔ admin),
count: orders started/completed, payment issues, exceptions rescued.
Send me the numbers + every operator SMS text → regexes pinned, and the
day's learnings folded into the bot before it takes over.

## What launches later (unchanged external gates)

Meta approval → templates → Cloud API webhook (gateway server is built
and tested, deploy is hours once hosting exists) · cd.tunakula.com
tokens +