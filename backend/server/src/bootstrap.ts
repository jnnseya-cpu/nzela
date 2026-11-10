import { join } from "node:path";
import type { Server } from "node:http";
import { MemoryLedger, type LedgerSink } from "@nzela/ledger";
import { spineFromEnv } from "@nzela/analytics";
import {
  StackFoodClient,
  CustomerAuthProvisioner,
  FileTokenCache,
  InMemoryPasswordVault,
  OrderAdapter,
} from "@nzela/stackfood-client";
import { FileKV } from "@nzela/persistence";
import {
  createGateway,
  CloudApiSender,
  ConsoleSender,
  ConversationEngine,
  FileSessionStore,
  buildStackFoodCatalog,
  buildStackFoodOrderPort,
  type WhatsAppSender,
  type OrderPort,
} from "@nzela/gateway";
import { createLipaIngest, FileReplayIndex } from "@nzela/lipa-ingest";
import { TrendCoordinator, NZELA_PROFILE } from "@nzela/trend-intelligence";
import { OpenOrderBook } from "./open-orders.js";
import type { AppConfig } from "./config.js";

/**
 * The production bootstrap — the thing that was missing. Every piece of this
 * OS existed and was tested in isolation, but nothing composed them into one
 * runnable service reading real config. This does exactly that: it wires the
 * StackFood client + auth + order adapter + conversation engine into the
 * gateway, wires the SMS Ledger Bridge into lipa, joins them through a
 * durable open-order book, and fans payment-verified events out to analytics
 * and back to the customer on WhatsApp.
 *
 * It is a pure factory: `fetch` and the ledger are injectable, so the whole
 * two-service system can be built and exercised in a test with no network,
 * no ports bound, and no credentials. `main.ts` is the only thing that reads
 * `process.env` and calls `.listen()`.
 */
export interface BuildDeps {
  /** Injected transport for StackFood + WhatsApp + analytics (tests). */
  fetchImpl?: typeof fetch;
  /** Ledger sink override (defaults to in-process MemoryLedger). */
  ledger?: LedgerSink;
  /** Env for the analytics spine (defaults to process.env). */
  env?: Record<string, string | undefined>;
  /**
   * Outbound sender override. When omitted, the real Cloud API sender is
   * used if credentials are set, else a console sender. Tests inject a
   * capturing sender here.
   */
  sender?: WhatsAppSender;
}

export interface BuiltServices {
  gateway: Server;
  lipa: Server;
  sender: WhatsAppSender;
  openOrders: OpenOrderBook;
  ledger: LedgerSink;
  /** Embedded trend-intelligence control layer, fed by live orders/payments. */
  trends: TrendCoordinator;
}

export function buildServices(config: AppConfig, deps: BuildDeps = {}): BuiltServices {
  const ledger = deps.ledger ?? new MemoryLedger();
  const d = (name: string) => join(config.dataDir, name);
  // At-rest encryption key for the token / PII / financial stores (AES-256-GCM
  // via FileKV). Undefined → plaintext (dev). A bad key throws here at boot.
  const encKey = config.dataEncryptionKey;

  // --- StackFood transport + identity + placement ---
  const client = new StackFoodClient(
    { baseUrl: config.stackfoodBaseUrl, zoneIds: config.stackfoodZoneIds },
    deps.fetchImpl,
  );
  const auth = new CustomerAuthProvisioner(
    client,
    new FileTokenCache(d("tokens.json"), encKey),
    new InMemoryPasswordVault(),
  );
  const adapter = new OrderAdapter(client);

  // --- analytics (inert unless META_*/GA4_* set) ---
  const analytics = spineFromEnv(deps.env ?? process.env, deps.fetchImpl);

  // --- outbound WhatsApp: injected override, else real Cloud API when
  //     configured, else console ---
  const sender: WhatsAppSender =
    deps.sender ??
    (config.waAccessToken && config.waPhoneNumberId
      ? new CloudApiSender({
          phoneNumberId: config.waPhoneNumberId,
          accessToken: config.waAccessToken,
          graphVersion: config.waGraphVersion,
          fetchImpl: deps.fetchImpl,
        })
      : new ConsoleSender());

  // --- durable monotonic TK-ref sequence (survives restart) ---
  const seq = new FileKV(d("seq.json"));
  const nextSequence = () => {
    const n = (seq.get<number>("tkref") ?? 0) + 1;
    seq.set("tkref", n);
    return n;
  };

  // --- the join: placed-but-unpaid orders shared by gateway + lipa ---
  const openOrders = new OpenOrderBook(d("open-orders.json"), encKey);

  // --- Trend Intelligence control layer, embedded in the live platform:
  //     every real order (demand) and verified payment (conversion) feeds the
  //     coordinator, which scores topics and issues Growth Briefs that steer
  //     the SEO + growth agents. Headline demand topic for the pilot. ---
  const trends = new TrendCoordinator(NZELA_PROFILE, ledger);
  const DEMAND_TOPIC = "livraison-whatsapp-kinshasa";

  // --- conversation engine on real StackFood ports ---
  const catalog = buildStackFoodCatalog(client);
  const basePort = buildStackFoodOrderPort({
    client,
    auth,
    adapter,
    zone: config.deliveryZone,
    nextSequence,
    payInstructions: (tkRef, totalFc) => payInstructions(config, tkRef, totalFc),
  });
  // Wrap placement so every real order is recorded for payment reconciliation.
  const orders: OrderPort = {
    async place(session) {
      const placed = await basePort.place(session);
      openOrders.add({
        tkRef: placed.tkRef,
        totalFc: placed.totalFc ?? 0,
        waId: session.waId,
      });
      // Feed the trend coordinator: a reached checkout is first-party demand.
      trends.record({
        kind: "order_placed",
        topic: DEMAND_TOPIC,
        atMs: Date.now(),
        dedupKey: placed.tkRef,
        market: "CD",
      });
      return placed;
    },
    status: (waId) => basePort.status(waId),
  };

  const conversation = new ConversationEngine({
    sessions: new FileSessionStore(d("sessions.json"), encKey),
    catalog,
    orders,
    ledger,
    analytics,
  });

  const gateway = createGateway({
    waVerifyToken: config.waVerifyToken,
    stackfoodWebhookSecret: config.stackfoodWebhookSecret,
    waAppSecret: config.waAppSecret,
    sender,
    conversation,
  });

  // --- SMS Ledger Bridge: verify a payment → mark paid → tell the customer ---
  const lipa = createLipaIngest({
    ingestToken: config.lipaIngestToken,
    openOrders: async () => openOrders.open(),
    onVerified: async (tkRef, operator) => {
      openOrders.markPaid(tkRef, operator);
      // Strongest first-party signal: a real, paid, reconciled order.
      trends.record({
        kind: "payment_verified",
        topic: DEMAND_TOPIC,
        atMs: Date.now(),
        dedupKey: tkRef,
        market: "CD",
      });
      const waId = openOrders.waIdFor(tkRef);
      if (waId) {
        await sender.sendText(
          waId,
          `Paiement reçu ✅ (${operator}) pour ta commande ${tkRef}. ` +
            `On lance la cuisine — je te tiens au courant à chaque étape. Merci ! 🙏`,
        );
      }
    },
    ledger,
    replayIndex: new FileReplayIndex(d("replay.json"), encKey),
    analytics,
  });

  return { gateway, lipa, sender, openOrders, ledger, trends };
}

/**
 * Build the customer pay instructions block appended to a récap: the
 * merchant mobile-money numbers configured for the pilot, the amount, and
 * the TK ref the customer must put in the payment note so the SMS Ledger
 * Bridge can match it. Only operators with a configured number are shown.
 */
export function payInstructions(config: AppConfig, tkRef: string, totalFc: number): string {
  const fc = totalFc.toLocaleString("fr-FR");
  const lines: string[] = [];
  const m = config.merchantNumbers;
  if (m.mpesa) lines.push(`• M-Pesa : ${m.mpesa}`);
  if (m.orange) lines.push(`• Orange Money : ${m.orange}`);
  if (m.airtel) lines.push(`• Airtel Money : ${m.airtel}`);
  if (m.africell) lines.push(`• Afrimoney : ${m.africell}`);
  const numbers = lines.length ? lines.join("\n") : "• (numéros marchands à configurer)";
  return (
    `💵 *Paiement — ${fc} FC*\n` +
    `Envoie le montant exact à l'un de ces numéros :\n` +
    `${numbers}\n` +
    `⚠️ Mets la référence *${tkRef}* dans la note du paiement. ` +
    `Dès réception je confirme et la cuisine démarre.`
  );
}
