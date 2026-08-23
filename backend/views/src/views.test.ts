import { describe, it, expect, beforeEach } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createViewsServer } from "./server.js";
import { MemoryViewStore, validSlug } from "./store.js";

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

describe("MemoryViewStore", () => {
  it("increments and reads per slug", async () => {
    const s = new MemoryViewStore();
    expect(await s.get("a")).toBe(0);
    expect(await s.increment("a")).toBe(1);
    expect(await s.increment("a")).toBe(2);
    expect(await s.increment("b")).toBe(1);
    expect(await s.getMany(["a", "b", "c"])).toEqual({ a: 2, b: 1, c: 0 });
  });
});

describe("validSlug", () => {
  it("accepts clean slugs, rejects junk", () => {
    expect(validSlug("livraison-repas-bandal")).toBe(true);
    expect(validSlug("Bad Slug")).toBe(false);
    expect(validSlug("../etc/passwd")).toBe(false);
    expect(validSlug("")).toBe(false);
    expect(validSlug(123)).toBe(false);
  });
});

describe("createViewsServer", () => {
  let base: string;
  let server: Server;

  beforeEach(async () => {
    server = createViewsServer({ store: new MemoryViewStore() });
    base = await listen(server);
    return () => server.close();
  });

  it("POST /views/hit increments and returns the count with CORS", async () => {
    const r = await fetch(`${base}/views/hit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "livraison-repas-bandal" }),
    });
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    const body = await r.json();
    expect(body).toEqual({ slug: "livraison-repas-bandal", views: 1 });
  });

  it("rejects an invalid slug", async () => {
    const r = await fetch(`${base}/views/hit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "no spaces allowed" }),
    });
    expect(r.status).toBe(400);
  });

  it("de-dups repeat hits from the same client within the window", async () => {
    const hit = (): Promise<any> =>
      fetch(`${base}/views/hit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "payer-cash-a-la-livraison" }),
      }).then((r) => r.json());
    const first = await hit();
    const second = await hit();
    expect(first.views).toBe(1);
    expect(second.views).toBe(1); // not re-incremented
    expect(second.deduped).toBe(true);
  });

  it("GET /views?slug and ?slugs read counts", async () => {
    await fetch(`${base}/views/hit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "devenir-wewa-70-pourcent" }),
    });
    const one = (await (await fetch(`${base}/views?slug=devenir-wewa-70-pourcent`)).json()) as any;
    expect(one.views).toBe(1);
    const many = (await (await fetch(`${base}/views?slugs=devenir-wewa-70-pourcent,unknown-post`)).json()) as any;
    expect(many.views["devenir-wewa-70-pourcent"]).toBe(1);
    expect(many.views["unknown-post"]).toBe(0);
  });

  it("answers CORS preflight", async () => {
    const r = await fetch(`${base}/views/hit`, { method: "OPTIONS" });
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
