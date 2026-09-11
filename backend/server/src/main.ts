import { configFromEnv, missingLaunchConfig } from "./config.js";
import { buildServices } from "./bootstrap.js";

/**
 * The single entry point that turns NZELA-OS from "a repo of tested modules"
 * into "two running services". Reads env, composes everything, binds the
 * gateway and the lipa ingest, and prints a clear launch-readiness report so
 * a half-configured deploy is obvious instead of silently broken.
 *
 *   node backend/server/src/main.ts     (via tsx in dev)
 */
export function main(): void {
  const config = configFromEnv();
  const { gateway, lipa } = buildServices(config);

  const missing = missingLaunchConfig(config);
  if (missing.length) {
    console.warn(
      "⚠️  NOT launch-ready — missing config:\n  - " +
        missing.join("\n  - ") +
        "\n(The services still start; outbound WhatsApp falls back to console " +
        "logging and unsigned webhooks are accepted until these are set.)",
    );
  } else {
    console.log("✅ Launch config present.");
  }

  // At-rest encryption advisory (recommended in production, optional in dev).
  console.log(
    config.dataEncryptionKey
      ? "🔒 At-rest encryption ON — token/PII/financial stores are AES-256-GCM encrypted."
      : "🔓 At-rest encryption OFF — set DATA_ENCRYPTION_KEY (`openssl rand -base64 32`) to encrypt the token/PII stores on disk.",
  );

  gateway.listen(config.gatewayPort, () => {
    console.log(`gateway  → http://0.0.0.0:${config.gatewayPort}  (GET/POST /wa/webhook, POST /hooks/stackfood)`);
  });
  lipa.listen(config.lipaPort, () => {
    console.log(`lipa     → http://0.0.0.0:${config.lipaPort}  (POST /lipa/sms)`);
  });

  const shutdown = () => {
    console.log("shutting down…");
    gateway.close();
    lipa.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Run when invoked directly (not when imported by a test).
if (process.argv[1] && process.argv[1].endsWith("main.ts")) {
  main();
}
