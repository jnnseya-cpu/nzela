import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createGateway } from "./server.js";
import { signWebhook } from "./webhook.js";
import { MemoryLedger } from "@nzela/ledger";

const sent: { waId: string; body: string }[] = [];
const ledger = new MemoryLedger();
let server: Server;
let base: string;

beforeAll(async () => {
  server = createGateway({
    waVerifyToken: "verify-me",
    stackfoodWebhookSecret: "shhh",
    ledger,
    sender: {
      async sendText(waId, body) {
        sent.push({ waId, body });
      },
    },
    tkRefFor: (id) => (id === 991 ? "TK-347" : undefined),
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (typeof addr === "object" && addr) base = `http://127.0.0.1:${addr.port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("gateway HTTP service", () => {
  it("reports healthy", async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
  });

  it("completes the Meta verification handshake", async () => {
    const ok = await fetch(
      `${base}/wa/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345`,
    );
    expect(await ok.text()).toBe("12345");
    const bad = await fetch(
      `${base}/wa/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`,
    );
    expect(bad.status).toBe(403);
  });

  it("routes an off-topic inbound through the firewall and replies", async () => {
    const res = await fetch(`${base}/wa/webhook`, {
      method: "POST",
      body: JSON.stringify({
        entry: [{ changes: [{ value: { messages: [
          { from: "243810000047", type: "text", text: { body: "parle-moi de politique" } },
        ] } }] }],
      }),
    });
    expect(res.status).toBe(200);
    expect(sent.at(-1)).toMatchObject({ waId: "+243810000047" });
    expect(sent.at(-1)!.body).toContain("nourriture");
  });

  it("rejects StackFood webhooks with a bad signature", async () => {
    const res = await fetch(`${base}/hooks/stackfood`, {
      method: "POST",
      headers: { "X-NZELA-Signature": "deadbeef" },
      body: JSON.stringify({ order_id: 991, new_status: "confirmed" }),
    });
    expect(res.status).toBe(401);
  });

  it("accepts a signed status change and pings the customer milestone", async () => {
    const body = JSON.stringify({
      order_id: 991,
      new_status: "picked_up",
      customer_wa_id: "+243810000047",
    });
    const res = await fetch(`${base}/hooks/stackfood`, {
      method: "POST",
      headers: { "X-NZELA-Signature": signWebhook(body, "shhh") },
      body,
    });
    expect(res.status).toBe(200);
    expect(sent.at(-1)!.body).toContain("en route");
    expect(ledger.events.at(-1)).toMatchObject({
      type: "lifecycle",
      tkRef: "TK-347",
    });
  });
});
