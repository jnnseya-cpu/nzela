import type { LedgerSink } from "@nzela/ledger";
import type { AnalyticsSpine } from "@nzela/analytics";
import { Router } from "./router.js";
import type { Session, SessionStore, CartItem } from "./session.js";

/**
 * Conversation engine — the real order state machine. Turns a WhatsApp
 * message + session into the next reply and the next state, driving the full
 * happy path: restaurants → menu → cart → address → authoritative-priced
 * checkout → idempotent placement. Deterministic and testable; the catalog
 * and order ports are injected (StackFood-backed in production, fakes in
 * tests). Nothing here trusts a customer-supplied price — placement goes
 * through the authoritative pricing port.
 */

export interface RestaurantOption {
  id: number;
  name: string;
  etaMin?: number;
}

export interface MenuChoice {
  food_id: number;
  name: string;
  price: number;
}

export interface CatalogPort {
  restaurants(waId: string): Promise<readonly RestaurantOption[]>;
  menu(restaurantId: number): Promise<readonly MenuChoice[]>;
}

export interface PlacedOrder {
  tkRef: string;
  orderId: number;
  /** Full customer récap with authoritative total + pay instructions. */
  recap: string;
  /**
   * Authoritative order total (FC). Optional for back-compat with fakes;
   * the real StackFood port always sets it so the payment side (lipa) can
   * reconcile the SMS amount against what was actually charged.
   */
  totalFc?: number;
}

export interface OrderPort {
  place(session: Session): Promise<PlacedOrder>;
  status(waId: string): Promise<string | undefined>;
}

export interface ConversationDeps {
  sessions: SessionStore;
  catalog: CatalogPort;
  orders: OrderPort;
  ledger: LedgerSink;
  analytics?: AnalyticsSpine;
}

export interface Inbound {
  text?: string;
  buttonId?: string;
  isVoiceNote?: boolean;
}

export interface EngineResult {
  replies: string[];
}

const fmtFc = (n: number) => `${n.toLocaleString("fr-FR")} FC`;

function parseSelection(t: string): { index: number; qty: number } | undefined {
  const m = t.trim().match(/^(\d{1,3})(?:\s*[x×]\s*(\d{1,3}))?$/);
  if (!m) return undefined;
  const index = Number(m[1]);
  const qty = m[2] ? Number(m[2]) : 1;
  if (index < 1 || qty < 1 || qty > 50) return undefined;
  return { index, qty };
}

function renderRestaurants(list: readonly RestaurantOption[]): string {
  const rows = list
    .slice(0, 8)
    .map((r, i) => `${i + 1}. ${r.name}${r.etaMin ? ` · ~${r.etaMin} min` : ""}`)
    .join("\n");
  return `Voici les restos près de toi 🍽️\n${rows}\n\nRéponds avec le numéro.`;
}

function renderMenu(name: string, list: readonly MenuChoice[]): string {
  const rows = list
    .slice(0, 12)
    .map((m, i) => `${i + 1}. ${m.name} — ${fmtFc(m.price)}`)
    .join("\n");
  return `Menu — ${name} 🍽️\n${rows}\n\nRéponds avec le numéro (ex. «2» ou «2x3»). Tape «panier» ou «payer» quand tu es prêt.`;
}

function renderCart(cart: readonly CartItem[]): string {
  if (!cart.length) return "Ton panier est vide. Tape «menu».";
  const rows = cart
    .map((c) => `• ${c.quantity}× ${c.name} — ${fmtFc(c.price * c.quantity)}`)
    .join("\n");
  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  return `Ton panier 🛒\n${rows}\nSous-total: ${fmtFc(total)}\n\nAjoute un numéro, ou tape «payer».`;
}

const GREETING =
  "Mbote 👋 Ici Mama Tunakula. Tape «Nakolia» pour commander à manger, " +
  "livré chaud près de chez toi.";
const RESET_MSG = "C'est reparti à zéro 👍 Tape «Nakolia» pour commander.";
const FIREWALL =
  "Maman, ici on parle nourriture 😄 Dis «Nakolia» ou tape un plat.";
const ASK_ADDRESS =
  "Où je livre ? Donne l'adresse par repères — ex. «Bandal, 2e avenue, " +
  "après l'église, portail vert».";

const RESET_WORDS = ["annuler", "reset", "recommencer", "stop"];
const PAY_WORDS = ["payer", "checkout", "commander", "valider", "payé"];

export class ConversationEngine {
  private readonly router: Router;
  constructor(private readonly deps: ConversationDeps) {
    this.router = new Router(deps.ledger);
  }

  async handle(waId: string, inbound: Inbound): Promise<EngineResult> {
    const session = await this.deps.sessions.get(waId);
    const text = (inbound.text ?? "").trim();
    const low = text.toLowerCase();

    // Global: reset from any phase.
    if (RESET_WORDS.some((w) => low === w)) {
      await this.deps.sessions.reset(waId);
      return { replies: [RESET_MSG] };
    }

    switch (session.phase) {
      case "selecting-restaurant":
        return this.onSelectRestaurant(session, low);
      case "browsing-menu":
      case "cart-review":
        return this.onMenuOrCart(session, low);
      case "awaiting-address":
        return this.onAddress(session, text);
      case "awaiting-payment":
      case "placed":
        return this.onAfterPlacement(session, low);
      case "idle":
      default:
        return this.onIdle(session, inbound, low);
    }
  }

  private async onIdle(session: Session, inbound: Inbound, low: string): Promise<EngineResult> {
    const decision = this.router.route(
      { waId: session.waId, text: inbound.text, buttonId: inbound.buttonId, isVoiceNote: inbound.isVoiceNote },
      "idle",
    );
    if (decision.kind === "deterministic" && decision.action === "order-status") {
      return this.showStatus(session);
    }
    if (decision.kind === "firewall-block") {
      // Only firewall true off-topic; greetings pass to a warm hello.
      if (/(mbote|bonjour|salut|hello|hi)\b/.test(low)) return { replies: [GREETING] };
      return { replies: [FIREWALL] };
    }
    // Any order intent (deterministic show-restaurants, or food free text)
    // starts the real selection flow.
    return this.startRestaurants(session);
  }

  private async startRestaurants(session: Session): Promise<EngineResult> {
    const list = await this.deps.catalog.restaurants(session.waId);
    if (!list.length) {
      return { replies: ["Aucun resto ouvert tout près pour l'instant. Réessaie dans un moment."] };
    }
    session.phase = "selecting-restaurant";
    session.restaurantList = list.map((r) => ({ id: r.id, name: r.name }));
    await this.deps.sessions.save(session);
    return { replies: [renderRestaurants(list)] };
  }

  private async onSelectRestaurant(session: Session, low: string): Promise<EngineResult> {
    const sel = parseSelection(low);
    const list = session.restaurantList ?? [];
    if (!sel || sel.index > list.length) {
      return { replies: ["Réponds avec le numéro du resto (ex. «1»)."] };
    }
    const chosen = list[sel.index - 1]!;
    const menu = await this.deps.catalog.menu(chosen.id);
    if (!menu.length) {
      return { replies: [`${chosen.name} n'a pas de plat dispo là. Choisis un autre numéro.`] };
    }
    session.restaurantId = chosen.id;
    session.restaurantName = chosen.name;
    session.menuList = menu.map((m) => ({ food_id: m.food_id, name: m.name, price: m.price }));
    session.phase = "browsing-menu";
    await this.deps.sessions.save(session);
    return { replies: [renderMenu(chosen.name, menu)] };
  }

  private async onMenuOrCart(session: Session, low: string): Promise<EngineResult> {
    if (low === "panier") return { replies: [renderCart(session.cart)] };
    if (low === "menu") {
      return { replies: [renderMenu(session.restaurantName ?? "resto", session.menuList ?? [])] };
    }
    if (PAY_WORDS.some((w) => low.includes(w))) {
      return this.startCheckout(session);
    }
    const sel = parseSelection(low);
    const menu = session.menuList ?? [];
    if (!sel || sel.index > menu.length) {
      return { replies: ["Tape le numéro d'un plat (ex. «2» ou «2x3»), «panier» ou «payer»."] };
    }
    const item = menu[sel.index - 1]!;
    const existing = session.cart.find((c) => c.food_id === item.food_id);
    if (existing) existing.quantity += sel.qty;
    else session.cart.push({ food_id: item.food_id, name: item.name, price: item.price, quantity: sel.qty });
    session.phase = "cart-review";
    await this.deps.sessions.save(session);
    return { replies: [`Ajouté ✅ ${sel.qty}× ${item.name}\n\n${renderCart(session.cart)}`] };
  }

  private async startCheckout(session: Session): Promise<EngineResult> {
    if (!session.cart.length) {
      return { replies: ["Ton panier est vide — ajoute d'abord un plat."] };
    }
    if (!session.addressText) {
      session.phase = "awaiting-address";
      await this.deps.sessions.save(session);
      return { replies: [ASK_ADDRESS] };
    }
    return this.place(session);
  }

  private async onAddress(session: Session, text: string): Promise<EngineResult> {
    if (text.length < 6) {
      return { replies: ["Donne un peu plus de détail sur l'adresse (quartier + repère)."] };
    }
    session.addressText = text;
    await this.deps.sessions.save(session);
    return this.place(session);
  }

  private async place(session: Session): Promise<EngineResult> {
    if (this.deps.analytics) {
      await this.deps.analytics.emit({
        name: "InitiateCheckout",
        eventId: `InitiateCheckout:${session.waId}`,
        at: Date.now(),
        custom: { channel: "whatsapp" },
      });
    }
    let placed: PlacedOrder;
    try {
      placed = await this.deps.orders.place(session);
    } catch (err) {
      this.deps.ledger.write({
        type: "lifecycle",
        agent: "commande",
        purpose: `order placement failed: ${String(err).slice(0, 120)}`,
        costUsd: 0,
        at: new Date(),
      });
      return { replies: ["Oups, je n'ai pas pu finaliser la commande. Réessaie dans un instant, ou tape «annuler»."] };
    }
    session.phase = "awaiting-payment";
    session.tkRef = placed.tkRef;
    session.orderId = placed.orderId;
    await this.deps.sessions.save(session);
    return { replies: [placed.recap] };
  }

  private async onAfterPlacement(session: Session, low: string): Promise<EngineResult> {
    if (["statut", "status", "où", "wapi"].some((w) => low.includes(w))) {
      return this.showStatus(session);
    }
    if (low.includes("nakolia") || low.includes("menu")) {
      // Start a fresh order without losing the placed one's ref.
      const fresh: Session = { waId: session.waId, phase: "idle", cart: [] };
      await this.deps.sessions.save(fresh);
      return this.startRestaurants(fresh);
    }
    return {
      replies: [
        `Ta commande ${session.tkRef ?? ""} est en cours. Envoie le paiement avec ta référence, ou tape «statut».`,
      ],
    };
  }

  private async showStatus(session: Session): Promise<EngineResult> {
    const status = await this.deps.orders.status(session.waId);
    return { replies: [status ?? "Tu n'as pas de commande en cours. Tape «Nakolia»."] };
  }
}
