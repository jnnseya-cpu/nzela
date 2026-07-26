import { createServer, type IncomingMessage, type Server } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { MemoryLedger, type LedgerSink } from "@nzela/ledger";
import { parseSms } from "./parsers.js";
import { verifyPayment, MemoryReplayIndex, type ReplayIndex } from "./replay.js";
import type { OpenOrder } from "./matcher.js";

/**
 * Lipa Box ingest endpoint — the HTTPS side of the SMS Ledger Bridge
 * (FR-P1). The Android forwarder on the merchant phone POSTs every
 * incoming SMS here; parsing, matching and replay protection run
 * immediately and the verdict is returned to the caller (and ledgered).
 *
 * Endpoints:
 *   GET  /healthz    — liveness + last-SMS heartbeat age
 *   POST /lipa/sms   — {from, body, receivedAt?, sim?} + X-Lipa-Token
 *
 * Compatible with any forwarder that can POST JSON to a URL with a
 * custom header (SMS-forwarder apps, MacroDroid, Tasker, android-sms-
 * gateway). The shared token is the only credential the phone holds.
 */

export interface LipaIngestConfig {
  /** Shared secret the forwarder sends as X-Lipa-Token. */
  ingestToken: string;
  /** Open (unpaid) orders lookup — Redis/Postgres in production. */
  openOrders: () => Promise<readonly OpenOrder[]>;
  /** Called on a successful match so the order flips to paid. */
  onVerified: (tkRef: string, operator: string) => Promise<void>;
  ledger?: LedgerSink;
  replayIndex?: ReplayIndex;
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

function tokenOk(provided: string | string[] | undefined, expected: string) {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createLipaIngest(config: LipaIngestConfig): Server {
  const ledger = config.ledger ?? new MemoryLedger();
  const replay = config.replayIndex ?? new MemoryReplayIndex();
  let lastSmsAt: Date | undefined;

  return createServer(async (req, res) => {
    const json = (code: number, obj: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    try {
      if (req.method === "GET" && req.url === "/healthz") {
        return json(200, {
          ok: true,
          lastSmsAgeSec: lastSmsAt
            ? Math.round((Date.now() - lastSmsAt.getTime()) / 1000)
            : null,
        });
      }
      if (req.method === "POST" && req.url === "/lipa/sms") {
        if (!tokenOk(req.headers["x-lipa-token"], config.ingestToken)) {
          return json(401, { error: "bad token" });
        }
        const sms = JSON.parse(await readBody(req)) as {
          from?: string;
          body?: string;
        };
        if (!sms.body) return json(400, { error: "body required" });
        lastSmsAt = new Date();

        const parsed = parseSms(sms.body, sms.from ?? "");
        if (!parsed) {
          // Not a payment confirmation (promo, balance alert…) — logged,
          // never an error: the forwarder sends everything.
          ledger.write({
            type: "deterministic",
            agent: "lipa",
            purpose: `non-payment SMS ignored (${(sms.from ?? "?").slice(0, 16)})`,
            costUsd: 0,
            at: new Date(),
          });
          return json(200, { verdict: "ignored" });
        }

        const result = verifyPayment(
          parsed,
          await config.openOrders(),
          replay,
          ledger,
        );
        if (result.matched) {
          await config.onVerified(result.order.tkRef, parsed.operator);
          return json(200, {
            verdict: "verified",
            tkRef: result.order.tkRef,
            operator: parsed.operator,
            amountFc: parsed.amountFc,
          });
        }
        return json(200, {
          verdict: result.replay ? "replay-rejected" : "unmatched",
          reason: "reason" in result ? result.reason : undefined,
          operator: parsed.operator,
          amountFc: parsed.amountFc,
        });
      }
      return json(404, { error: "not found" });
    } catch (err) {
      return json(500, { error: String(err).slice(0, 200) });
    }
  });
}
