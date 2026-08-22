import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { MetaCapiSink } from "./meta-capi.js";
import { Ga4Sink } from "./ga4-mp.js";
import { AnalyticsSpine, NoopSink } from "./spine.js";
import { spineFromEnv } from "./env.js";
import { hashPhone, hashPii, eventIdFor } from "./util.js";
import type { ConversionEvent, FetchLike } from "./types.js";

function captureFetch() {
  const calls: { url: string; body: any }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, text: async () => "" };
  };
  return { calls, fetchImpl };
}

const baseEvent: ConversionEvent = {
  name: "Purchase",
  eventId: "Purchase:TK-347",
  at: 1_700_000_000_000,
  value: 22540,
  currency: "CDF",
  tkRef: "TK-347",
  user: { phone: "+243 810 000 047", externalId: "+243810000047" },
  custom: { operator: "mpesa", channel: "whatsapp" },
};

describe("MetaCapiSink", () => {
  it("skips (no network) when not configured", async () => {
    const { calls } = captureFetch();
    const sink = new MetaCapiSink({ pixelId: "__META_PIXEL_ID__", accessToken: "__x__" });
    const r = await sink.send(baseEvent);
    expect(r.skipped).toBe(true);
    expect(r.ok).toBe(true);
    expect(calls.length).toBe(0);
  });

  it("posts a hashed, deduped payload when configured", async () => {
    const { calls, fetchImpl } = captureFetch();
    const sink = new MetaCapiSink({ pixelId: "123456789012345", accessToken: "TOKEN123", fetchImpl });
    const r = await sink.send(baseEvent);
    expect(r.ok).toBe(true);
    expect(calls.length).toBe(1);
    const call = calls[0]!;
    expect(call.url).toContain("/123456789012345/events");
    const d = call.body.data[0];
    expect(d.event_name).toBe("Purchase");
    expect(d.event_id).toBe("Purchase:TK-347"); // dedup key
    expect(d.event_time).toBe(1_700_000_000); // seconds
    // phone hashed with digits only (no +, no spaces)
    expect(d.user_data.ph).toBe(createHash("sha256").update("243810000047").digest("hex"));
    // raw phone never leaves the process
    expect(JSON.stringify(call.body)).not.toContain("810 000 047");
    expect(d.custom_data.value).toBe(22540);
    expect(d.custom_data.currency).toBe("CDF");
    expect(d.custom_data.order_id).toBe("TK-347");
  });
});

describe("Ga4Sink", () => {
  it("skips when not configured", async () => {
    const { calls } = captureFetch();
    const sink = new Ga4Sink({ measurementId: "__GA4__", apiSecret: "" });
    const r = await sink.send(baseEvent);
    expect(r.skipped).toBe(true);
    expect(calls.length).toBe(0);
  });

  it("maps Purchase -> purchase with transaction_id and value", async () => {
    const { calls, fetchImpl } = captureFetch();
    const sink = new Ga4Sink({ measurementId: "G-ABC123", apiSecret: "SECRET", fetchImpl });
    const r = await sink.send(baseEvent);
    expect(r.ok).toBe(true);
    const call = calls[0]!;
    expect(call.url).toContain("measurement_id=G-ABC123");
    const ev = call.body.events[0];
    expect(ev.name).toBe("purchase");
    expect(ev.params.transaction_id).toBe("TK-347");
    expect(ev.params.value).toBe(22540);
    expect(ev.params.currency).toBe("CDF");
    expect(call.body.client_id).toMatch(/^\d+\.\d+$/);
  });
});

describe("AnalyticsSpine", () => {
  it("fans out to all sinks and NEVER throws when a sink fails", async () => {
    const throwing = {
      name: "boom",
      send: async () => {
        throw new Error("network down");
      },
    };
    const spine = new AnalyticsSpine({ sinks: [new NoopSink(), throwing] });
    const results = await spine.emit(baseEvent);
    expect(results.length).toBe(2);
    expect(results.find((r) => r.sink === "noop")?.ok).toBe(true);
    const boom = results.find((r) => r.sink === "boom");
    expect(boom?.ok).toBe(false);
    expect(boom?.error).toContain("network down");
  });

  it("spineFromEnv is fully inert with no env configured", async () => {
    const spine = spineFromEnv({});
    const results = await spine.emit(baseEvent);
    expect(results.every((r) => r.skipped)).toBe(true);
    expect(spine.sinkNames).toEqual(["meta-capi", "ga4-mp"]);
  });
});

describe("hash + id helpers", () => {
  it("hashPhone strips non-digits before hashing", () => {
    expect(hashPhone("+243 810-000-047")).toBe(hashPhone("243810000047"));
  });
  it("hashPii lowercases and trims", () => {
    expect(hashPii("  Justin@Example.COM ")).toBe(hashPii("justin@example.com"));
  });
  it("eventIdFor is stable per (name, tkRef) for pixel/CAPI dedup", () => {
    expect(eventIdFor("Purchase", "TK-347")).toBe("Purchase:TK-347");
  });
});
