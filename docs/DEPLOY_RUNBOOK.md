# NZELA-OS — Deploy Runbook (turnkey)

The **honest** shape of this platform, and exactly how to ship it. There is
**no Firebase and no Next.js** here (see "Stack reality" below); anyone
expecting those is looking at the wrong playbook.

## What actually deploys

| Piece | What it is | How it ships |
|---|---|---|
| **Marketing site** | Static: landing `/`, blog `/blog` (+ posts), partner dashboard `/pro`, PWA kit, sitemap/robots/`llms.txt` | `frontend/build.mjs` → `frontend/dist` → any static host, **or** the `nzela-web` nginx image |
| **Backend services** | `@nzela/server` composes the **gateway** (WhatsApp webhook + conversation engine + StackFood hook) and **lipa** (SMS Ledger Bridge) into one Node process on two ports | the `nzela-server` Docker image / any Node 22 host |

Both are driven by injected file-backed stores — genuine single-instance
durability with **no external database** (Redis/Postgres only when you scale
horizontally).

## One command (local or a single Docker host)

```bash
cp .env.example .env      # fill in what you have — see "Config" below
docker compose up --build
#  web  → http://localhost:8081   (landing / blog / pro)
#  api  → http://localhost:8080   (GET/POST /wa/webhook, POST /hooks/stackfood)
#  lipa → http://localhost:8090   (POST /lipa/sms)
```

`api` persists its stores in the `nzela-data` volume (sessions, StackFood
tokens, open orders, payment replay index, TK-ref sequence) — state survives
restarts.

### Or build/run the images directly
```bash
docker build -t nzela-server .                     # backend services
docker run --env-file .env -p 8080:8080 -p 8090:8090 -v nzela-data:/data nzela-server

docker build -f Dockerfile.web -t nzela-web .      # static site
docker run -p 8081:80 nzela-web
```

### Or without Docker (any Node 22 host)
```bash
pnpm install --frozen-lockfile
pnpm build:site          # → frontend/dist  (upload to a static host)
pnpm start               # runs the gateway + lipa (node --import tsx …/main.ts)
```

## Config (`.env`) — what's required vs optional

The server **starts either way** and prints, at boot, exactly which required
keys are missing (`missingLaunchConfig`). Nothing fails silently.

- **Required to take a real order end-to-end:** `WA_ACCESS_TOKEN`,
  `WA_PHONE_NUMBER_ID`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET`,
  `LIPA_INGEST_TOKEN`, `STACKFOOD_WEBHOOK_SECRET`, at least one
  `MERCHANT_*` mobile-money number.
- **Optional / degrade safely:** analytics (`META_*`, `GA4_*`) stay inert
  until set; no `WA_*` → replies log to console instead of sending;
  no `WA_APP_SECRET` → inbound signatures are **not** verified (dev only).

Full list + comments: [`.env.example`](../.env.example) and
[`backend/server/src/config.ts`](../backend/server/src/config.ts).

## The WhatsApp number (launch decision D-1)

Single source of truth: **`frontend/site.config.mjs` → `WA_NUMBER`**. Change
that one value (digits only) and rebuild the site (`pnpm build:blog &&
pnpm build:site`); it propagates to the landing, every blog page, and the
dashboard. Today it is the **+44 pilot line** — for a Kinshasa audience a +44
number reads as foreign, so a local **+243** line is the single most
important pre-launch swap.

## Static site → managed hosts (no Docker needed)

`pnpm build:site` also emits host configs into `dist/`:
- **Netlify / Cloudflare Pages** — `_redirects`, `netlify.toml`
- **Vercel** — `vercel.json`
- **Apache / cPanel (cd.tunakula.com family)** — `.htaccess`

Point the host at `frontend/dist` (build command `pnpm build:site`, publish
dir `frontend/dist`). Clean routes, sitemap, robots, `llms.txt` are included.

## Health & monitoring
- `GET /healthz` on **8080** (gateway) and **8090** (lipa) → `{ok:true}`.
  Both Docker images declare `HEALTHCHECK`s against these.
- lipa's `/healthz` also reports `lastSmsAgeSec` — a dead Lipa Box forwarder
  shows as a rising age.

## Human-gated (NOT code — cannot be shipped from the repo)

Deploy makes the platform *reachable*; these make it *usable*, and only you
can supply them:
1. A live **+243** WhatsApp number + **WhatsApp Cloud API** credentials.
2. **StackFood** service tokens + webhook secret; run where the host can
   reach `cd.tunakula.com`.
3. **Merchant mobile-money SIMs** + the Lipa Box forwarder pointed at
   `/lipa/sms` with `LIPA_INGEST_TOKEN`.
4. A **hosting account** (static host + a Node/Docker host) and DNS.
5. Signed **restaurants + wewas** in Bandal.

## Scaling beyond one instance
File-backed stores are correct and durable for a single instance. For
multi-instance / high concurrency, put Redis/Postgres behind the same
injected interfaces (`TokenCache`, `ReplayIndex`, session/open-order/ACU
stores) and a real secrets manager for `PasswordVault`. No schema migrations
are written yet.

## Stack reality (so nobody chases the wrong fix)
- **No Firebase.** No `firebase.json`, `.firebaserc`, Firebase SDK, Auth, or
  Security Rules exist. Auth is **per-customer StackFood bearer tokens**
  (auto-provisioned, cached) + **HMAC-verified webhooks** (StackFood
  `X-NZELA-Signature`, WhatsApp `X-Hub-Signature-256`) + a shared-secret Lipa
  ingest token. Firestore/Storage rules are **N/A**.
- **No Next.js.** The site is hand-built static HTML assembled by
  `build.mjs`; the partner dashboard is a static demo UI. There is no Next.js
  build to stabilise.
