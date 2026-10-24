# Human Action List — only a person can clear these (then I resume the loop)

Each is BLOCKED on something outside my authority: credentials, hardware,
hosting, money, or a business/legal decision. None is a code defect.

| # | Action | Owner | Why it blocks launch | What I do the moment it's supplied |
|---|---|---|---|---|
| H-1 | Provide a live **+243** WhatsApp number + **WhatsApp Cloud API** creds (access token, phone-number-id, WABA, app secret, verify token) | Justin | No channel → no customer can message; the +44 line reads as scam | Set `WA_*` in `.env` + `WA_NUMBER` in `site.config.mjs`, rebuild, verify inbound signature + a real round-trip |
| H-2 | Provide a **hosting** account (static host + a Node/Docker host) + DNS/TLS | Justin | No public URL exists to deploy or test against | `docker compose up --build` (or static host for the site), smoke the live `/healthz` + a real journey |
| H-3 | Provide **StackFood** service tokens + webhook secret, and run where `cd.tunakula.com` is reachable | Justin | Can't read a real menu or place a real order; sandbox only so far | Place one real test order; verify the live order→status→notify path |
| H-4 | Provision **merchant mobile-money SIMs** + the Lipa Box forwarder → `/lipa/sms` with `LIPA_INGEST_TOKEN` | Justin | No real payment can be verified; "auto-confirm 30 s" (TA-3) is unmet until this exists | Run one real mobile-money payment end-to-end; confirm reconciliation (ledger difference = 0) |
| H-5 | Decide **TA-1 (voice ordering)**: fund the LLM voice agent (AI keys + build) OR approve relabelling the claim "bientôt" | Justin | Headline feature advertised but not implemented — a promise the product can't keep | Build the agent, or edit the copy/blog to mark voice as upcoming |
| H-6 | Decide **TA-2 (positioning)**: launch now, OR approve a waitlist/"bientôt à Bandal" reframe of public surfaces | Justin | Site claims a live, open service that doesn't exist yet | Flip to live, or build the waitlist/coming-soon variant |
| H-7 | Sign **≥3 restaurants + ~5 wewas** in Bandal, rehearsed | Justin | No supply = no fulfilment; density needed before any ads | — (operational; I support with partner dashboard/onboarding copy) |
| H-8 | Back up the data volume + the `DATA_ENCRYPTION_KEY`; approve a secrets manager | Justin | A lost key makes encrypted stores unreadable; no DR without volume backups | Wire a documented backup/restore runbook + (optional) KMS integration |
| H-9 | Penetration test + legal sign-off (terms/privacy/refund, AI disclosure) | external | Security/compliance cannot be self-certified | Remediate findings; wire consent/deletion where applicable |
