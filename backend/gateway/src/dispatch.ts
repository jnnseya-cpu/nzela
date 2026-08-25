import type { LedgerSink } from "@nzela/ledger";
import type { AnalyticsSpine } from "@nzela/analytics";
import type { RouteDecision } from "./router.js";
import type { WhatsAppSender } from "./server.js";

/**
 * Conversation dispatch — the layer that was missing: it turns a Router
 * decision into an actual reply and sends it. Before this, only firewall
 * blocks got a response and a normal ordering message got nothing back.
 *
 * Deterministic-first and dependency-light: every reply is rendered from
 * injected data providers (StackFood catalog, session cart, authoritative
 * pricing) with a safe canned fallback when a provider is absent, so the
 * order loop always answers — no LLM keys, no live number required. Agent
 * escalations call the (Phase-2) LLM agent when wired, else degrade to a
 * deterministic nudge. Nothing here throws to the caller.
 */

export interface DispatchDeps {
  sender: WhatsAppSender;
  ledger: LedgerSink;
  /** Restaurants near the customer (StackFood + landmark-graph at deploy). */
  restaurantsNear?: (waId: string) => Promise<readonly RestaurantChoice[]>;
  /** Rendered menu for the customer's selected restaurant. */
  menuFor?: (waId: string) => Promise<string | undefined>;
  /** Rendered current cart. */
  cartFor?: (waId: string) => Promise<string | undefined>;
  /** Checkout récap — MUST be built with server-authoritative pricing. */
  checkoutRecap?: (waId: string) => Promise<string | undefined>;
  /** Current order status line. */
  orderStatus?: (waId: string) => Promise<string | undefined>;
  /** Commande LLM agent (Phase 2); returns the reply. Optional. */
  commandeAgent?: (waId: string, text: string) => Promise<string>;
  /** Adresse LLM agent (Phase 2); returns the reply. Optional. */
  adresseAgent?: (waId: string, text: string) => Promise<string>;
  /** Optional funnel analytics (server-side). */
  analytics?: AnalyticsSpine;
}

export interface RestaurantChoice {
  name: string;
  etaMin?: number;
}

export interface DispatchResult {
  /** Every message body sent, in order (for tests/observability). */
  sent: string[];
}

export const GREETING =
  "Mbote 👋 Ici Mama Tunakula. Dis-moi «Nakolia» ou touche «Restos» pour " +
  "commander à manger, livré chaud près de chez toi.";

const NO_RESTOS =
  "Dis-moi ton quartier (ex. «Bandal, après l'église Sainte-Anne») et je te " +
  "montre les restos ouverts près de toi.";
const NEED_RESTO = "Choisis d'abord un resto — tape «resto» ou «menu».";
const EMPTY_CART = "Ton panier est vide. Tape «menu» pour ajouter un plat.";
const NOTHING_TO_CHECKOUT =
  "Ajoute d'abord un plat à ton panier, puis reviens payer.";
const NO_ACTIVE_ORDER =
  "Tu n'as pas de commande en cours. Tape «Nakolia» pour commander.";
const COMMANDE_FALLBACK =
  "J'ai bien noté 👍 Pour aller vite : touche «Restos» pour voir les " +
  "restaurants près de toi, ou écris le plat que tu veux.";
const ADRESSE_FALLBACK =
  "Donne-moi ton adresse par repères — ex. «Bandal, 2e avenue, après " +
  "l'église, portail vert» — et je l'enregistre pour la livraison.";

function renderRestaurants(list: readonly RestaurantChoice[]): string {
  if (!list.length) return NO_RESTOS;
  const rows = list
    .slice(0, 8)
    .map((r, i) => `${i + 1}. ${r.name}${r.etaMin ? ` · ~${r.etaMin} min` : ""}`)
    .join("\n");
  return `Voici les restos près de toi 🍽️\n${rows}\n\nRéponds avec le numéro de ton choix.`;
}

/**
 * Dispatch a routing decision to the customer. Never throws — a provider or
 * agent failure degrades to a safe reply so the loop always answers.
 */
export async function dispatch(
  decision: RouteDecision,
  waId: string,
  deps: DispatchDeps,
): Promise<DispatchResult> {
  const sent: string[] = [];
  const send = async (body: string, purpose: string) => {
    try {
      await deps.sender.sendText(waId, body);
      sent.push(body);
      deps.ledger.write({
        type: "deterministic",
        agent: "router",
        purpose: `dispatch: ${purpose}`,
        costUsd: 0,
        at: new Date(),
      });
    } catch {
      /* send failure is logged upstream; never break the loop */
    }
  };

  const provided = async (
    fn: ((waId: string) => Promise<string | undefined>) | undefined,
    fallback: string,
  ): Promise<string> => {
    if (!fn) return fallback;
    try {
      return (await fn(waId)) ?? fallback;
    } catch {
      return fallback;
    }
  };

  switch (decision.kind) {
    case "firewall-block":
      await send(decision.reply, "firewall-block");
      break;

    case "deterministic":
      switch (decision.action) {
        case "greeting":
          await send(GREETING, "greeting");
          break;
        case "show-restaurants": {
          let body = NO_RESTOS;
          if (deps.restaurantsNear) {
            try {
              body = renderRestaurants(await deps.restaurantsNear(waId));
            } catch {
              body = NO_RESTOS;
            }
          }
          await send(body, "show-restaurants");
          break;
        }
        case "show-menu":
          await send(await provided(deps.menuFor, NEED_RESTO), "show-menu");
          break;
        case "show-cart":
          await send(await provided(deps.cartFor, EMPTY_CART), "show-cart");
          break;
        case "checkout": {
          const recap = await provided(deps.checkoutRecap, NOTHING_TO_CHECKOUT);
          await send(recap, "checkout");
          // Funnel signal — server-side InitiateCheckout (fail-safe).
          if (deps.analytics) {
            await deps.analytics.emit({
              name: "InitiateCheckout",
              eventId: `InitiateCheckout:${waId}`,
              at: Date.now(),
              custom: { channel: "whatsapp" },
            });
          }
          break;
        }
        case "order-status":
          await send(
            await provided(deps.orderStatus, NO_ACTIVE_ORDER),
            "order-status",
          );
          break;
      }
      break;

    case "agent-commande": {
      let body = COMMANDE_FALLBACK;
      if (deps.commandeAgent) {
        try {
          body = await deps.commandeAgent(waId, decision.text);
        } catch {
          body = COMMANDE_FALLBACK;
        }
      }
      await send(body, "agent-commande");
      break;
    }

    case "agent-adresse": {
      let body = ADRESSE_FALLBACK;
      if (deps.adresseAgent) {
        try {
          body = await deps.adresseAgent(waId, decision.text);
        } catch {
          body = ADRESSE_FALLBACK;
        }
      }
      await send(body, "agent-adresse");
      break;
    }
  }

  return { sent };
}
