import type { LedgerSink } from "@nzela/ledger";

/**
 * NZELA Router — agent #1 (§5, FR-A2/FR-A3). Classifies EVERY inbound
 * message before any LLM sees it. Buttons and keywords route
 * deterministically at zero tokens; only unresolved free text / voice
 * reaches the Commande or Adresse agents. Off-topic content gets a canned
 * redirect (the AI firewall) at zero token cost, and the block is logged.
 */

export type SessionPhase =
  | "idle"
  | "ordering"
  | "awaiting-address"
  | "awaiting-payment"
  | "in-delivery"
  | "rating";

export type RouteDecision =
  /** Deterministic UI route — buttons, lists, canned replies. 0 tokens. */
  | { kind: "deterministic"; action: DeterministicAction }
  /** Escalate to Commande Agent (free text / voice order). */
  | { kind: "agent-commande"; text: string }
  /** Escalate to Adresse Agent (address phase free text / voice). */
  | { kind: "agent-adresse"; text: string }
  /** AI firewall: off-topic → canned redirect, zero tokens, logged. */
  | { kind: "firewall-block"; reply: string };

export type DeterministicAction =
  | "show-restaurants"
  | "show-menu"
  | "show-cart"
  | "checkout"
  | "order-status"
  | "greeting";

export interface InboundMessage {
  waId: string;
  /** Interactive button/list reply id, when the tap came from our UI. */
  buttonId?: string;
  text?: string;
  isVoiceNote?: boolean;
  tkRef?: string;
}

/** Keyword sets kept deliberately small — the spine is buttons-first. */
const ORDER_KEYWORDS = [
  "menu",
  "commander",
  "commande",
  "nakolia",
  "manger",
  "resto",
  "restaurant",
  "faim",
];
const STATUS_KEYWORDS = ["où", "ou est", "statut", "status", "wapi"];
/** Food vocabulary that signals an order intent worth an LLM call. */
const FOOD_HINTS = [
  "poulet",
  "poisson",
  "thomson",
  "madesu",
  "riz",
  "fufu",
  "brochette",
  "chèvre",
  "chevre",
  "jus",
  "tangawisi",
  "gingembre",
  "mayo",
  "taco",
  "mikate",
  "beignet",
  "pizza",
  "liboke",
  "pondu",
  "saka",
];

export const FIREWALL_REPLY =
  "Maman, ici on parle nourriture 😄 Dis-moi un plat — ex. «poulet mayo» — " +
  "ou touche les boutons.";

const BUTTON_ACTIONS: Record<string, DeterministicAction> = {
  btn_restos: "show-restaurants",
  btn_menu: "show-menu",
  btn_cart: "show-cart",
  btn_checkout: "checkout",
  btn_status: "order-status",
};

export class Router {
  constructor(private readonly ledger: LedgerSink) {}

  route(msg: InboundMessage, phase: SessionPhase): RouteDecision {
    // 1. Button taps are always deterministic — the spine.
    if (msg.buttonId) {
      const action = BUTTON_ACTIONS[msg.buttonId];
      if (action) {
        this.log("deterministic", `button ${msg.buttonId}`, msg.tkRef);
        return { kind: "deterministic", action };
      }
    }

    const text = (msg.text ?? "").trim();
    const low = text.toLowerCase();

    // 2. Voice notes route by phase: address phase → Adresse, else Commande.
    if (msg.isVoiceNote) {
      if (phase === "awaiting-address") {
        return { kind: "agent-adresse", text };
      }
      return { kind: "agent-commande", text };
    }

    if (!text) {
      this.log("block", "empty message", msg.tkRef);
      return { kind: "firewall-block", reply: FIREWALL_REPLY };
    }

    // 3. Address phase: free text is an address description.
    if (phase === "awaiting-address") {
      return { kind: "agent-adresse", text };
    }

    // 4. Simple keyword routes — zero tokens.
    if (ORDER_KEYWORDS.some((k) => low.includes(k))) {
      this.log("deterministic", `keyword route: restaurants`, msg.tkRef);
      return { kind: "deterministic", action: "show-restaurants" };
    }
    if (STATUS_KEYWORDS.some((k) => low.includes(k))) {
      this.log("deterministic", `keyword route: status`, msg.tkRef);
      return { kind: "deterministic", action: "order-status" };
    }

    // 5. Food-shaped free text earns a Commande Agent call.
    if (FOOD_HINTS.some((k) => low.includes(k))) {
      return { kind: "agent-commande", text };
    }

    // 6. Everything else — politics, chit-chat, prompt injection — is
    //    firewalled: canned redirect, zero tokens, block logged (FR-A3).
    this.log("block", "off-topic → canned redirect", msg.tkRef);
    return { kind: "firewall-block", reply: FIREWALL_REPLY };
  }

  private log(
    type: "deterministic" | "block",
    purpose: string,
    tkRef?: string,
  ): void {
    this.ledger.write({
      type,
      agent: "router",
      purpose,
      costUsd: 0,
      tkRef,
      at: new Date(),
    });
  }
}
