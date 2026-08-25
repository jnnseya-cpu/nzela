import { createServer, type IncomingMessage, type Server } from "node:http";
import { MemoryLedger, type LedgerSink } from "@nzela/ledger";
import type { StackFoodOrderStatus } from "@nzela/stackfood-client";
import { Router, type SessionPhase } from "./router.js";
import { renderMilestone } from "./status-mapping.js";
import { verifyWebhookSignature } from "./webhook.js";
import { dispatch, type DispatchDeps } from "./dispatch.js";

/**
 * NZELA Gateway — the deployable HTTP service. Dependency-free (node:http)
 * so it runs anywhere Node 22 runs; NestJS decoration can come later
 * without changing these contracts.
 *
 * Endpoints:
 *   GET  /healthz            — liveness for the load balancer
 *   GET  /wa/webhook         — Meta webhook verification handshake
 *   POST /wa/webhook         — WhatsApp Cloud API inbound messages → Router
 *   POST /hooks/stackfood    — StackFood OrderObserver pushes (HMAC-signed)
 *
 * Message sending is behind the WhatsAppSender port so the server is fully
 * testable and the Cloud API client is one file when credentials arrive.
 */

export interface WhatsAppSender {
  sendText(waId: string, body: string): Promise<void>;
}

export interface GatewayConfig {
  /** Token echoed in Meta's GET verification handshake. */
  waVerifyToken: string;
  /** Shared secret for the StackFood observer HMAC. */
  stackfoodWebhookSecret: string;
  ledger?: LedgerSink;
  sender: WhatsAppSender;
  /** Session phase lookup — Redis in production, map in tests. */
  phaseFor?: (waId: string) => SessionPhase;
  /** TK ref lookup for an order id (nzela_order_map). */
  tkRefFor?: (orderId: number) => string | undefined;
  /**
   * Conversation dispatch providers (restaurants/menu/cart/checkout/status,
   * LLM agents, analytics). All optional — absent providers degrade to safe
   * canned replies so the order loop always answers. `sender`/`ledger` are
   * supplied by the gateway itself.
   */
  dispatch?: Omit<DispatchDeps, "sender" | "ledger">;
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

export function createGateway(config: GatewayConfig): Server {
  const ledger = config.ledger ?? new MemoryLedger();
  const router = new Router(ledger);
  const phaseFor = config.phaseFor ?? (() => "idle" as const);

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://gateway");
    const json = (code: number, obj: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    };

    try {
      if (req.method === "GET" && url.pathname === "/healthz") {
        return json(200, { ok: true });
      }

      // Meta verification handshake (Cloud API webhook setup).
      if (req.method === "GET" && url.pathname === "/wa/webhook") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        if (mode === "subscribe" && token === config.waVerifyToken) {
          res.writeHead(200, { "Content-Type": "text/plain" });
          return res.end(challenge);
        }
        return json(403, { error: "verification failed" });
      }

      // WhatsApp inbound → Router (deterministic spine first, FR-A2).
      if (req.method === "POST" && url.pathname === "/wa/webhook") {
        const payload = JSON.parse(await readBody(req));
        const messages =
          payload?.entry?.[0]?.changes?.[0]?.value?.messages ?? [];
        for (const m of messages) {
          const waId: string = `+${m.from}`;
          const decision = router.route(
            {
              waId,
              text: m.text?.body,
              buttonId:
                m.interactive?.button_reply?.id ??
                m.interactive?.list_reply?.id,
              isVoiceNote: m.type === "audio",
            },
            phaseFor(waId),
          );
          // Every decision now gets a reply — deterministic actions, agent
          // escalations and firewall blocks all flow through dispatch.
          await dispatch(decision, waId, {
            sender: config.sender,
            ledger,
            ...config.dispatch,
          });
        }
        return json(200, { received: messages.length });
      }

      // StackFood observer → customer milestone (FR-S2/S3).
      if (req.method === "POST" && url.pathname === "/hooks/stackfood") {
        const body = await readBody(req);
        const signature = req.headers["x-nzela-signature"];
        if (
          typeof signature !== "string" ||
          !verifyWebhookSignature(body, signature, config.stackfoodWebhookSecret)
        ) {
          return json(401, { error: "bad signature" });
        }
        const event = JSON.parse(body) as {
          order_id: number;
          new_status: StackFoodOrderStatus;
          customer_wa_id?: string;
        };
        ledger.write({
          type: "lifecycle",
          agent: "system",
          purpose: `stackfood ${event.new_status} (order ${event.order_id})`,
          costUsd: 0,
          tkRef: config.tkRefFor?.(event.order_id),
          at: new Date(),
        });
        if (event.customer_wa_id) {
          await config.sender.sendText(
            event.customer_wa_id,
            renderMilestone(event.new_status),
          );
        }
        return json(200, { ok: true });
      }

      return json(404, { error: "not found" });
    } catch (err) {
      return json(500, { error: String(err).slice(0, 200) });
    }
  });
}
