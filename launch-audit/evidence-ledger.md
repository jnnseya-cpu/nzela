# Evidence Ledger (2026-10-24, RC commit at audit time: HEAD of claude/new-session-yygh5a)

Status ∈ PASS · FAIL · PARTIAL · BLOCKED · NOT TESTED · N/A.
BLOCKED and NOT TESTED are never PASS. Every PASS below was produced by
**executing** something, not by reading code.

## Executed — PASS (with how)
| ID | Check | How (command) | Result |
|---|---|---|---|
| E-1 | Typecheck clean | `pnpm typecheck` (tsc --noEmit, strict + noUncheckedIndexedAccess) | PASS |
| E-2 | Full test suite | `pnpm test` (vitest run) | **288 passed / 43 files** |
| E-3 | Blog quality gate | `pnpm build:blog` | 17 posts ≥90 SEO & AEO; gate passed |
| E-4 | Static site build | `pnpm build:site` | dist assembled, 17 posts + index + 404 |
| E-5 | Production dep audit | `pnpm audit --prod` | **No known vulnerabilities** |
| E-6 | Dev dep audit | `pnpm audit` | 17 (dev-only: vite/esbuild/vitest dev-server), documented |
| E-7 | Secret scan (tracked) | `git ls-files \| grep .env` | only `.env.example`; no secrets committed |
| E-8 | Code smells | grep `any`/`@ts-ignore`/`eslint-disable` in backend+shared (excl tests) | 0 / 0 / 0 |
| E-9 | Service boots | `node --import tsx backend/server/src/main.ts` | gateway:8080 + lipa:8090 bind, honest readiness report |
| E-10 | At-rest encryption ON | boot with `DATA_ENCRYPTION_KEY` | logs "🔒 encryption ON"; token file is AES-GCM envelope (not plaintext) |

## Executed — adversarial live-boot over real HTTP sockets (21/21 PASS)
Harness: scratchpad `adversarial.mts` — real `createGateway`/`createLipaIngest`
servers, StackFood injected as a sandbox mock, WhatsApp sender captured (no real
funds, no real messages — Safety Rule 4.6).
| ID | Boundary attacked | Result |
|---|---|---|
| A-1,2 | gateway + lipa `/healthz` | 200 |
| A-3,4 | Meta webhook verify (correct / wrong token) | echoes challenge / 403 |
| A-5,6,7 | **Forged / missing** `X-Hub-Signature-256` inbound | **401, and no reply sent (no side effect)** |
| A-8 | Full order over HTTP (valid sigs) → OpenOrderBook | order TK-1 recorded, total 12 460 FC, récap+pay-instructions sent |
| A-9 | StackFood hook bad HMAC | 401 |
| A-10 | lipa bad ingest token | 401 |
| A-11,12,13 | Valid payment SMS → verify → notify | verified, order flipped paid, "Paiement reçu" sent |
| A-14 | **Replay** same SMS | **replay-rejected (no double-credit)** |
| A-15..20 | Novice/hostile inputs (emoji, blank, `'; DROP TABLE…`, accents, lingala) | handled, no 5xx |

## Covered by executed unit/integration tests (E-2 suite)
server-authoritative pricing + tamper guard; order idempotency (no double-place);
payment matcher no-underpayment tolerance + content-fingerprint replay burn;
AES-256-GCM round-trip + wrong-key-throws + tamper-detect + plaintext migration;
HMAC signature verify (both webhooks); humanity/WAF firewall; conversation state
machine happy + reset + firewall paths; durable stores survive simulated restart.

## NOT TESTED / BLOCKED (no access from this environment — never counted as PASS)
| Area | Status | Why |
|---|---|---|
| Live deployed URL / browser walkthrough | NOT TESTED | nothing deployed; no staging URL; no browser against a live app |
| Novice time-to-value on a real phone / slow 3G | NOT TESTED | requires a live product to walk |
| Live StackFood / WhatsApp Cloud API / Meta / GA4 | BLOCKED | no credentials; sandbox only |
| Real mobile-money payment (end-to-end, reconciled) | BLOCKED | needs merchant SIMs + Lipa Box + live money |
| Load / stress / soak / Core Web Vitals | NOT TESTED | no load infra; no deployed target |
| Monitoring / alerting / tracing fire-drills | NOT TESTED | not provisioned (no APM/uptime wired) |
| Privacy deletion executed across all stores | NOT TESTED | no production data/stores to act on |
| Docker image build | BLOCKED | base-image registry egress blocked in sandbox; builds run in GitHub CI |
| CI pipeline execution | NOT TESTED here | CI runs on GitHub, not in this container |
