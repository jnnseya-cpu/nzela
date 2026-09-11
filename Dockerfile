# NZELA-OS backend services — the gateway (WhatsApp webhook + conversation
# engine) and the lipa ingest (SMS Ledger Bridge), composed by @nzela/server
# and run as one process binding two ports. Runs the TypeScript directly with
# tsx (the project has no compile step; workspace packages resolve via their
# "main": "src/index.ts").
#
#   docker build -t nzela-server .
#   docker run --env-file .env -p 8080:8080 -p 8090:8090 -v nzela-data:/data nzela-server
#
# Single stage on purpose: pnpm's workspace layout (symlinks into
# node_modules/.pnpm) does not copy cleanly across build stages, so we install
# with the source present — correct linking, guaranteed. --prod keeps the
# runtime tree lean (no vitest / playwright / typescript / marked).
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PNPM_HOME=/pnpm PATH=/pnpm:$PATH \
    DATA_DIR=/data \
    GATEWAY_PORT=8080 \
    LIPA_PORT=8090
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Manifests + source for the workspace members the server needs.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend ./backend
COPY shared ./shared

# Production dependency tree only (tsx is a prod dep; dev tooling excluded).
RUN pnpm install --frozen-lockfile --prod \
 && useradd --create-home --uid 10001 nzela \
 && mkdir -p /data && chown -R nzela:nzela /data /app

USER nzela
VOLUME ["/data"]
EXPOSE 8080 8090

# Liveness: the gateway's own health endpoint (Node 22 has global fetch).
HEALTHCHECK --interval=30s --timeout=4s --start-period=8s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.GATEWAY_PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx", "backend/server/src/main.ts"]
