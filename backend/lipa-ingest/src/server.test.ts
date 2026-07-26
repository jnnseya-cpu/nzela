import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createLipaIngest } from "./server.js";
import type { OpenOrder } from "./matcher.js";

const verified: string[] = [];
const orders: OpenOrder[] = [
  { tkRef: "TK-347", totalFc: 22540, waId: "+243810000047", placedAt: new Date() },
];
let server: Server;
let base: string;

const post = (body: unknown, token = "sim-secret") =>
  fetch(`${base}/lipa/sms`, {
    method: "POST",
    headers: { "X-Lipa-Token": token },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  server = createLipaIngest({
    ingestToken: "sim-secret",
    openOrders: async () => orders,
    onVerified: async (tkRef) => {
      verified.push(tkRef);
    },
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (typeof addr === "object" && addr) base = `http://127.0.0.1:${addr.port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("Lipa Box ingest endpoint", () => {
  it("rejects a forwarder with the wrong token", async () => {
    const res = await post({ from: "M-PESA", body: "x" }, "wrong");
    expect(res.status).toBe(401);
  });

  it("verifies a real confirmation SMS and flips the order", async () => {
    const res = await post({
      from: "M-PESA",
      body: "QGH7X2K9M1 Confirme. Vous avez reçu 22.540 FC de +243810000047. Ref: TK-347.",
    });
    expect(await res.json()).toMatchObject({
      verdict: "verified",
      tkRef: "TK-347",
      operator: "mpesa",
    });
    expect(verified).toEqual(["TK-347"]);
  });

  it("rejects the same SMS forwarded twice (replay)", async () => {
    const res = await post({
      from: "M-PESA",
      body: "QGH7X2K9M1 Confirme. Vous avez reçu 22.540 FC de +243810000047. Ref: TK-347.",
    });
    expect(await res.json()).toMatchObject({ verdict: "replay-rejected" });
    expect(verified).toHaveLength(1); // not verified a second time
  });

  it("ignores non-payment SMS without failing", async () => {
    const res = await post({ from: "OrangeInfo", body: "Votre forfait expire demain" });
    expect(await res.json()).toEqual({ verdict: "ignored" });
  });

  it("reports heartbeat age on /healthz", async () => {
    const res = await fetch(`${base}/healthz`);
    const body = (await res.json()) as { ok: boolean; lastSmsAgeSec: number };
    expect(body.ok).toBe(true);
    expect(typeof body.lastSmsAgeSec).toBe("number");
  });
});
