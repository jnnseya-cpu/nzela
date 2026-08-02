# GO-LIVE READINESS VERDICT — read before tomorrow morning

**Date:** eve of launch · **Prepared for:** Justin Nseya
**Bottom line up front:** what you can take public tomorrow **safely** is
the **human-operated WhatsApp channel on cd.tunakula.com**. The
**fully automated bot cannot be safely public tomorrow** — not because
of code quality (the code is hardened and tested), but because of
external dependencies that no amount of coding tonight can conjure:
Meta approval, live credentials, running infrastructure, and — above
all — **payment tested with real money end-to-end**, which has not
happened and cannot happen from this environment.

This document is deliberately blunt because a false "GO" is the
reputation risk, not a delayed feature.

---

## What IS production-ready (verified tonight)

- **Engine code:** 102 automated tests + a 21-test UI campaign, all
  green, including adversarial suites: NaN/zero/negative amount attacks,
  spoofed-sender fraud attempts, prompt injection, fuzzed garbage,
  concurrent double-tap races, malformed payloads on every endpoint.
- **Three exploitable money-path bugs found and fixed tonight** (see
  commit 1aa8415): SMS false-verify via NaN, sender spoofing, order
  double-placement race. Each now has a regression test.
- **The manual playbook** (`LAUNCH_TOMORROW.md`) needs no code, no Meta,
  no servers — it rides on cd.tunakula.com, which is already live and
  already takes money. This is the safe public launch.

## What is NOT ready — the hard blockers for the AUTOMATED bot

| # | Blocker | Status | Can it be fixed tonight? |
|---|---|---|---|
| B1 | **Real payment tested end-to-end with actual money** | NEVER DONE | ❌ No — needs real SIMs + a real customer payment. This is THE gate. |
| B2 | WhatsApp Cloud API access (Meta verification + number + 6 approved templates) | Not started | ❌ No — Meta approval takes 1–5 business days |
| B3 | Production hosting running the gateway + Lipa ingest (TLS, Postgres, Redis) | Code exists, nothing deployed | ❌ No — needs cloud account + provisioning |
| B4 | cd.tunakula.com API wired with real service tokens + Postman field diff | Not done; domain unreachable from build env | ❌ No — needs your admin + a running server |
| B5 | Lipa Box hardware commissioned (4 SIMs, forwarder, verified per operator) | Not procured | ❌ No — physical procurement |
| B6 | Operator SMS regexes confirmed against REAL operator messages | Built on representative formats | ⚠ Partial — I pin them the moment you send real SMS |
| B7 | Load/soak test at expected concurrency on real infra | Not done | ❌ No — needs deployed infra |
| B8 | Staging StackFood instance (spec forbids dev against prod) | Not provisioned | ❌ No |

**Any one of B1–B5 unmet = the automated bot is NOT safe for public
launch.** All five are currently unmet.

## The honest recommendation

**Tomorrow morning: GO — with the manual channel.** Announce publicly,
take real orders, collect real money through cd.tunakula.com's existing
rails, verify mobile-money payments by a trained operator reading the
merchant SIM (the human Lipa Box). Reputation is safe because every
component in that path is already proven in production by your existing
business. The automated features roll in behind the scenes over the
following 7–10 days and replace the operator with zero customer-visible
change.

**Do NOT** flip the automated bot to the public until, at minimum:
B1 done (one real end-to-end paid order on production), B2 templates
approved, B3 deployed with monitoring, and the Day-6 dress rehearsal in
`GO_LIVE_CHECKLIST.md` passes on real infrastructure.

## If "full automated public launch tomorrow" is non-negotiable

Then these must ALL happen tonight/at dawn, in order, and if any fails
the answer is NO-GO:

1. Deploy gateway + Lipa ingest to real hosting with TLS + secrets.
2. Wire real cd.tunakula.com tokens; place ONE real test order visible
   in admin.
3. Commission at least ONE mobile-money operator: send a REAL payment,
   confirm auto-match in ≤30 s, then re-send to confirm replay-reject.
4. Confirm Meta templates are actually approved (or accept that
   restaurant/wewa cold-pings won't send — a hard functional gap).
5. Run 20 real end-to-end orders with staff before opening to the public.

Realistically that is not a one-night task, which is exactly why the
manual channel is the professional way to be genuinely public tomorrow
without gambling the brand.
