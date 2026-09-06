import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createHmac } from "node:crypto";
import { createGateway } from "./server.js";
import { verifyMetaSignature } from "./webhook.js";

const APP_SECRET = "meta-app-secret";
const sig = (body: string) =>
  "sha256=" + createHmac("sha256", APP_SECRET).update(body).digest("hex");

describe("verifyMetaSignature", () => {
  it("accepts a correct sha256= signature and rejects tampering", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(verifyMetaSignature(body, sig(body), APP_SECRET)).toBe(true);
    // prefix optional
    expect(verifyMetaSignature(body, sig(body).slice(7), APP_SECRET)).toBe(true);
    // wrong secret / altered body / missing header
    expect(verifyMetaSignature(body, sig(body), "other")).toBe(false);
    expect(verifyMetaSignature(body + " ", sig(body), APP_SECRET)).toBe(false);
    expect(verifyMetaSignature(body, undefined, APP_SECRET)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=zzz", APP_SECRET)).toBe(false);
  });
});

describe("gateway inbound signature enforcement", () => {
  const sent: { waId: string; body: string }[] = [];
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createGateway({
      waVerifyToken: "v",
      stackfoodWebhookSecret: "s",
      waAppSecret: APP_SECRET,
      sender: {
        async sendText(waId, body) {
          sent.push({ waId, body });
        },
      },
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const addr = server.address();
    if (typeof addr === "object" && addr) base = `http://127.0.0.1:${addr.port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const payload = JSON.stringify({
    entry: [{ changes: [{ value: { messages: [
      { from: "243810000099", type: "text", text: { body: "nakolia" } },
    ] } }] }],
  });

  it("rejects an inbound POST with no / bad signature (401, no reply sent)", async () => {
    const before = sent.length;
    const res = await fetch(`${base}/wa/webhook`, { method: "POST", body: payload });
    expect(res.status).toBe(401);
    expect(sent.length).toBe(before);
  });

  it("accepts an inbound POST carrying a valid X-Hub-Signature-256", async () => {
    const res = await fetch(`${base}/wa/webhook`, {
      method: "POST",
      headers: { "X-Hub-Signature-256": sig(payload) },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(sent.at(-1)).toMatchObject({ waId: "+243810000099" });
  });
});
