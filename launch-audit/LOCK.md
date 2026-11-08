# LOCK / Freeze Manifest — NZELA-OS

**Frozen:** 2026-11-08 · **Tag:** `v0.1.0-rc1` · **Branch:** `claude/new-session-yygh5a`

This records a verified, stable baseline. Everything below was **executed**, not
asserted. The git tag `v0.1.0-rc1` is the immutable reference to this exact state.

## Verified baseline (green at freeze)
| Check | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | clean (strict + noUncheckedIndexedAccess) |
| Tests | `pnpm test` | **288 passed / 43 files** |
| Blog quality gate | `pnpm build:blog` | 17 posts, **100/100 SEO & AEO**, gate passed |
| Site build | `pnpm build:site` | deterministic, 17 posts + index + 404 |
| Production deps | `pnpm audit --prod` | **No known vulnerabilities** |
| Adversarial live-boot | `launch-audit/` harness | **21/21** (signatures, token, replay, novice input) |
| Working tree | `git status` | clean, in sync with origin |

## What is LOCKED (cannot drift silently — only a reviewed commit changes it)
- **Dependencies** — pinned by `pnpm-lock.yaml`; CI installs with
  `--frozen-lockfile`, so an install that would change a version **fails**
  instead of drifting. Production runtime tree = `@nzela/*` + `tsx` only.
- **WhatsApp number** — single source `frontend/site.config.mjs` (`WA_NUMBER`);
  the build swaps it across every surface. No scattered copies to drift.
- **Blog** — generated deterministically from `frontend/blog/_corpus.ts`; the
  build **gate fails** any post below 90 on SEO or AEO, so quality can't silently
  regress.
- **Secrets** — none committed (`.env` git-ignored; only `.env.example`). At-rest
  encryption (AES-256-GCM) available via `DATA_ENCRYPTION_KEY`.
- **Security boundaries** — webhook HMAC (WhatsApp `X-Hub-Signature-256`,
  StackFood `X-NZELA-Signature`), lipa ingest token, server-authoritative
  pricing, payment replay burn — all covered by the test suite; a regression
  breaks `pnpm test`.
- **Builds are portable** — no hardcoded paths; reproducible on any machine/CI.

## The ONE intentionally-floating item (called out so it is never a surprise)
- **Docker base `node:22-slim`** floats to the latest patched Node 22.x on a
  `--pull` build (security-by-design, ≥ 22.23.4 / Oct-2026 CVE floor). It changes
  **only** on an explicit image rebuild, and only forward to a newer patch —
  never silently in the repository. To pin it exactly instead (full
  reproducibility, manual CVE bumps), set `FROM node:22.23.4-slim` — a deliberate
  future decision, not done here because image builds can't be verified in this
  sandbox.

## Source-of-truth rules
- The **git repo is the source of truth.** `frontend/dist/` is a build artifact
  (git-ignored) regenerated deterministically by `pnpm build:site`.
- `STATUS.md` is the authoritative platform-state record.
- Nothing in this baseline changes without a new commit on top of `v0.1.0-rc1`.

## What this baseline is NOT
Still **NO-GO for public launch** — blocked on external credentials/hosting/
hardware/business decisions, not code (see `launch-audit/human-actions.md`). The
lock freezes the *software*, which is production-grade; it does not make the
platform *live*.
