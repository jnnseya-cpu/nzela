import { createServer, type IncomingMessage, type Server } from "node:http";
import { MemoryViewStore, validSlug, type ViewStore } from "./store.js";

export interface ViewsConfig {
  store?: ViewStore;
  /** CORS origin allowed to call this counter (the blog origin). "*" ok for
   *  a public read/increment counter; set the real origin to be strict. */
  allowOrigin?: string;
  /**
   * Best-effort in-memory de-dup window (ms): the same IP hitting the same
   * slug within this window does NOT re-increment (returns the current
   * count). Stops trivial refresh inflation; production uses Redis TTL.
   */
  dedupWindowMs?: number;
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

/**
 * View-count endpoint for the static blog.
 *   POST /views/hit   {slug}         -> { slug, views }   (increments)
 *   GET  /views?slug=a               -> { slug, views }
 *   GET  /views?slugs=a,b,c          -> { views: {a,b,c} }
 *   GET  /healthz
 * All responses carry CORS headers so the blog (a different origin) can call.
 */
export function createViewsServer(config: ViewsConfig = {}): Server {
  const store = config.store ?? new MemoryViewStore();
  const allowOrigin = config.allowOrigin ?? "*";
  const dedupWindowMs = config.dedupWindowMs ?? 6 * 60 * 60 * 1000;
  const lastHit = new Map<string, number>();

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://views");
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const json = (code: number, obj: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json", ...cors });
      res.end(JSON.stringify(obj));
    };

    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        return res.end();
      }
      if (req.method === "GET" && url.pathname === "/healthz") {
        return json(200, { ok: true });
      }

      if (req.method === "POST" && url.pathname === "/views/hit") {
        const parsed = JSON.parse((await readBody(req)) || "{}");
        const slug = parsed.slug;
        if (!validSlug(slug)) return json(400, { error: "invalid slug" });

        const key = `${clientIp(req)}:${slug}`;
        const now = Date.now();
        const prev = lastHit.get(key);
        if (prev != null && now - prev < dedupWindowMs) {
          // Within the window: count once, just report the current total.
          return json(200, { slug, views: await store.get(slug), deduped: true });
        }
        lastHit.set(key, now);
        return json(200, { slug, views: await store.increment(slug) });
      }

      if (req.method === "GET" && url.pathname === "/views") {
        const many = url.searchParams.get("slugs");
        if (many != null) {
          const slugs = many.split(",").map((s) => s.trim()).filter(validSlug);
          return json(200, { views: await store.getMany(slugs) });
        }
        const slug = url.searchParams.get("slug");
        if (!validSlug(slug)) return json(400, { error: "invalid slug" });
        return json(200, { slug, views: await store.get(slug) });
      }

      return json(404, { error: "not found" });
    } catch (err) {
      return json(500, { error: String(err).slice(0, 200) });
    }
  });
}
