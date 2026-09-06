import { describe, expect, it, vi } from "vitest";
import { CloudApiSender, ConsoleSender } from "./wa-sender.js";

describe("CloudApiSender (WhatsApp Cloud API)", () => {
  it("POSTs a well-formed text message to the Graph endpoint", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.X" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const sender = new CloudApiSender({
      phoneNumberId: "123456",
      accessToken: "TOKEN",
      graphVersion: "v21.0",
      fetchImpl,
    });
    await sender.sendText("+243810000047", "Mbote 👋");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://graph.facebook.com/v21.0/123456/messages");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer TOKEN");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({
      messaging_product: "whatsapp",
      to: "243810000047", // leading + stripped
      type: "text",
      text: { body: "Mbote 👋", preview_url: false },
    });
  });

  it("throws with the Graph error body on a non-2xx response", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: { message: "Invalid token" } }), {
        status: 401,
      })) as unknown as typeof fetch;
    const sender = new CloudApiSender({ phoneNumberId: "1", accessToken: "bad", fetchImpl });
    await expect(sender.sendText("+243810000047", "hi")).rejects.toThrow(/401/);
  });

  it("ConsoleSender never throws and logs the message", async () => {
    const logs: string[] = [];
    const sender = new ConsoleSender((m) => logs.push(m));
    await sender.sendText("+243810000047", "line1\nline2");
    expect(logs[0]).toContain("+243810000047");
    expect(logs[0]).toContain("line1");
  });
});
