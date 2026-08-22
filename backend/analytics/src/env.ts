import { MetaCapiSink } from "./meta-capi.js";
import { Ga4Sink } from "./ga4-mp.js";
import { AnalyticsSpine } from "./spine.js";
import type { FetchLike } from "./types.js";

/**
 * Build a spine from environment variables. Unset / placeholder values leave
 * the corresponding sink inert (it reports `skipped`), so this is safe to
 * call in every environment including local/dev with nothing configured.
 *
 *   META_PIXEL_ID, META_CAPI_TOKEN, META_TEST_EVENT_CODE (optional)
 *   GA4_MEASUREMENT_ID, GA4_API_SECRET
 */
export function spineFromEnv(
  env: Record<string, string | undefined> = process.env,
  fetchImpl?: FetchLike,
): AnalyticsSpine {
  return new AnalyticsSpine({
    sinks: [
      new MetaCapiSink({
        pixelId: env.META_PIXEL_ID ?? "",
        accessToken: env.META_CAPI_TOKEN ?? "",
        testEventCode: env.META_TEST_EVENT_CODE,
        fetchImpl,
      }),
      new Ga4Sink({
        measurementId: env.GA4_MEASUREMENT_ID ?? "",
        apiSecret: env.GA4_API_SECRET ?? "",
        fetchImpl,
      }),
    ],
  });
}
