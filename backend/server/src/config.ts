import type { DeliveryZone } from "@nzela/landmark-graph";

/**
 * Every knob the production bootstrap reads, resolved from environment
 * variables in one place. Parsing lives here (not scattered through the
 * wiring) so `.env.example` and this file are the single contract for "what
 * do I need to set to go live". Missing optional values degrade safely
 * (console sender, inert analytics); missing REQUIRED values are reported by
 * `assertLaunchReady()` rather than failing silently.
 */
export interface AppConfig {
  gatewayPort: number;
  lipaPort: number;
  dataDir: string;

  stackfoodBaseUrl: string;
  stackfoodZoneIds: number[];
  stackfoodWebhookSecret: string;
  /** Admin bearer token for wallet credits (referral rewards). Optional. */
  stackfoodAdminToken: string | undefined;

  waVerifyToken: string;
  waAppSecret: string | undefined;
  waPhoneNumberId: string | undefined;
  waAccessToken: string | undefined;
  waGraphVersion: string | undefined;

  lipaIngestToken: string;

  deliveryZone: DeliveryZone;
  /** Merchant mobile-money numbers printed in the pay instructions. */
  merchantNumbers: {
    mpesa?: string;
    orange?: string;
    airtel?: string;
    africell?: string;
  };
}

const int = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
};

function parseZoneIds(v: string | undefined): number[] {
  if (!v) return [1];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
  } catch {
    /* fall through to CSV */
  }
  const csv = v.split(",").map((s) => Number(s.trim())).filter(Number.isFinite);
  return csv.length ? csv : [1];
}

function parseZone(v: string | undefined): DeliveryZone {
  const n = Number(v);
  return n === 2 || n === 3 ? (n as DeliveryZone) : 1;
}

export function configFromEnv(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    gatewayPort: int(env.GATEWAY_PORT, 8080),
    lipaPort: int(env.LIPA_PORT, 8090),
    dataDir: env.DATA_DIR ?? "./data",

    stackfoodBaseUrl: env.STACKFOOD_BASE_URL ?? "https://cd.tunakula.com/api/v1",
    stackfoodZoneIds: parseZoneIds(env.STACKFOOD_ZONE_IDS),
    stackfoodWebhookSecret: env.STACKFOOD_WEBHOOK_SECRET ?? "",
    stackfoodAdminToken: env.STACKFOOD_ADMIN_TOKEN || undefined,

    waVerifyToken: env.WA_VERIFY_TOKEN ?? "",
    waAppSecret: env.WA_APP_SECRET || undefined,
    waPhoneNumberId: env.WA_PHONE_NUMBER_ID || undefined,
    waAccessToken: env.WA_ACCESS_TOKEN || undefined,
    waGraphVersion: env.WA_GRAPH_VERSION || undefined,

    lipaIngestToken: env.LIPA_INGEST_TOKEN ?? "",

    deliveryZone: parseZone(env.DELIVERY_ZONE),
    merchantNumbers: {
      mpesa: env.MERCHANT_MPESA || undefined,
      orange: env.MERCHANT_ORANGE || undefined,
      airtel: env.MERCHANT_AIRTEL || undefined,
      africell: env.MERCHANT_AFRICELL || undefined,
    },
  };
}

/**
 * What MUST be set for a real customer to complete a real order. Returns the
 * list of missing keys (empty = launch-ready). The bootstrap logs these at
 * startup so a half-configured deploy is obvious rather than mysteriously
 * silent — it never fabricates a value.
 */
export function missingLaunchConfig(c: AppConfig): string[] {
  const missing: string[] = [];
  if (!c.waAccessToken) missing.push("WA_ACCESS_TOKEN");
  if (!c.waPhoneNumberId) missing.push("WA_PHONE_NUMBER_ID");
  if (!c.waVerifyToken) missing.push("WA_VERIFY_TOKEN");
  if (!c.waAppSecret) missing.push("WA_APP_SECRET");
  if (!c.lipaIngestToken) missing.push("LIPA_INGEST_TOKEN");
  if (!c.stackfoodWebhookSecret) missing.push("STACKFOOD_WEBHOOK_SECRET");
  const anyMerchant = Object.values(c.merchantNumbers).some(Boolean);
  if (!anyMerchant) missing.push("MERCHANT_MPESA (or ORANGE/AIRTEL/AFRICELL)");
  return missing;
}
