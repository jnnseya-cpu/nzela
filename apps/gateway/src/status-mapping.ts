import type { StackFoodOrderStatus } from "@nzela/stackfood-client";

/**
 * FR-S3: a single mapping table governs StackFood status → customer
 * milestone → template. It ships as config, not code — this module is that
 * config plus a lookup. Customer messages ride the free service window; only
 * cold pings to resto/wewa use paid utility templates.
 */

export interface MilestoneMapping {
  milestone: string;
  /** French customer copy; {vars} interpolated at send time. */
  customerMessage: string;
  /** WhatsApp template id when a paid template is needed (else free-form). */
  templateId?: string;
  paid: boolean;
}

export const STATUS_MILESTONES: Record<StackFoodOrderStatus, MilestoneMapping> =
  {
    pending: {
      milestone: "Créée",
      customerMessage: "Commande envoyée 🙏",
      paid: false,
    },
    confirmed: {
      milestone: "Acceptée",
      customerMessage: "👩🏾‍🍳 {resto} a accepté — prête vers {eta}",
      paid: false,
    },
    processing: {
      milestone: "En cuisine",
      customerMessage: "🔥 En cuisine",
      paid: false,
    },
    handover: {
      milestone: "Prête",
      customerMessage: "🍳 C'est prêt — {wewa} arrive au resto",
      paid: false,
    },
    picked_up: {
      milestone: "En route",
      customerMessage: "🏍️ {wewa} est en route · {eta} min",
      paid: false,
    },
    delivered: {
      milestone: "Livrée",
      customerMessage: "📍 Au portail! Bien reçu?",
      paid: false,
    },
    canceled: {
      milestone: "Annulée",
      customerMessage:
        "😔 Commande annulée — on te propose un plan B tout de suite.",
      paid: false,
    },
    failed: {
      milestone: "Remboursée",
      customerMessage: "🎟️ {montant} crédités sur ton Crédit Tunakula",
      paid: false,
    },
    refunded: {
      milestone: "Remboursée",
      customerMessage: "🎟️ {montant} crédités sur ton Crédit Tunakula",
      paid: false,
    },
  };

/**
 * The six Meta-approved utility templates required before launch (FR-M3).
 * Exact French copy is finalised from the prototype strings for submission.
 */
export const UTILITY_TEMPLATES = [
  "resto_new_order",
  "resto_reminder_escalation",
  "wewa_dispatch_offer",
  "customer_payment_received",
  "customer_wewa_assigned",
  "customer_order_delivered_rating",
] as const;

export function renderMilestone(
  status: StackFoodOrderStatus,
  vars: Record<string, string> = {},
): string {
  const mapping = STATUS_MILESTONES[status];
  return mapping.customerMessage.replace(
    /\{(\w+)\}/g,
    (_, k: string) => vars[k] ?? `{${k}}`,
  );
}
