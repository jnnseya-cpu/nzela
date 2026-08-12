# Humans-Only Access + Anti-Hacking (Sentinelle)

**Mandate (owner decision, ERRATA E-8):** only humans sign up and log in to
every section of the OS; all non-human instructions are blocked; an
anti-hacking agent is active. Implemented in `@nzela/security`, agent #11
(`sentinelle`).

Design honesty: no gate is 100% bot-proof. The strongest defence is
architectural — NZELA is WhatsApp-native, so **every account is bound to a
real SIM that answered an OTP and, to transact, moves real money.** That
makes mass fake accounts economically pointless. The software layers below
harden the web surfaces on top of that.

## 1. Humanity gate (`humanity.ts`) — 0 tokens

Scores several deterministic signals into `allow` / `challenge` / `block`,
placed in front of every auth and section-entry route:

- **Hard blocks:** filled honeypot field, automation user-agent
  (bot/headless/curl/python-requests/playwright/…), IP rate > 60/min.
- **Positive signals:** WhatsApp-verified phone (+30), passed challenge
  (+25), real pointer/keyboard interaction (+10), human-plausible fill
  time.
- **Negative signals:** sub-300ms submit, no interaction, no timing,
  elevated rate. Verdict thresholds: ≥70 allow, 40–69 challenge, <40 block.

## 2. Non-human-instruction firewall (`instruction-firewall.ts`) — 0 tokens

Blocks any inbound message that is a machine command rather than a human
ordering food, BEFORE any LLM sees it: prompt injection ("ignore previous
instructions", FR + EN), system-prompt extraction, jailbreaks ("you are
now DAN / developer mode"), chat-template control tokens
(`<|im_start|>`, `[INST]`), and code injection (SQL/XSS/traversal/shell).
Returns a canned French redirect; never echoes the payload.

## 3. Threat detection (`threat.ts`) — 0 tokens

WAF signatures for SQL injection, XSS, path traversal, command injection;
credential-stuffing detection (failed logins/min); rate-abuse detection;
and a pure, clock-injected `RateLimiter` (Redis-backed in prod).

## 4. Sentinelle agent (`sentinelle.ts`) — deterministic-first, AI gated

Orchestrates the above. Confident rule hits block at 0 tokens. Only a
payload the rules flag as *suspicious-but-unclassified* is escalated to an
LLM triage — and that call is **budget-capped ($0.006) AND ACU-gated**
(E-7). Critical property: the escalation **fails safe** — if triage can't
run (no ACU, provider down), the request is **challenged, never silently
allowed**. Every decision is a ledger security event.

## Wiring (deploy)

- Web surfaces (ops console, partner dashboard, entry page): call
  `Sentinelle.gateHumanity(signals, surface)` on every signup/login and
  section entry; render the challenge on `challenge`, deny on `block`.
- Gateway inbound: `Sentinelle.screenMessage(text)` before the Router, and
  `Sentinelle.inspect(requestSurface)` as WAF middleware on every HTTP
  route.
- Admin/API: combine with the existing HMAC (webhooks), IP allow-listing,
  and least-privilege tokens already in the codebase.

Tested: 16 cases — humanity allow/block/challenge, all four instruction
attack classes, the four WAF classes, rate limiting, confident-block
(no tokens), AI escalation, and the fail-safe-under-no-ACU path.
