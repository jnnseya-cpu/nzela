import type {
  PaymentMethod,
  StackFoodOrderStatus,
} from "@nzela/stackfood-client";
import { STATUS_MILESTONES } from "./status-mapping.js";
import type { FeeBreakdown } from "./recap.js";

/**
 * Customer-facing order receipt — mirrors the StackFood order-details view
 * (order id, date, restaurant, type, status, payment, items with add-ons,
 * full price breakdown). This is the ONLY end-of-order summary a customer
 * sees. The economic bilan (AI spend, margins, wewa split, coverage) is
 * ops-ledger material per FR-W4 and must never appear here.
 */

export interface ReceiptAddon {
  name: string;
  quantity: number;
  unitPriceFc: number;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPriceFc: number;
  addons?: ReceiptAddon[];
}

export interface OrderReceipt {
  stackfoodOrderId: number;
  tkRef: string;
  placedAt: Date;
  restaurantName: string;
  orderType: "delivery";
  status: StackFoodOrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: "paid" | "unpaid";
  cutlery: boolean;
  items: ReceiptItem[];
  fees: FeeBreakdown;
  discountFc?: number;
  couponFc?: number;
  dmTipsFc?: number;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash_on_delivery: "Cash à la livraison",
  wallet: "Crédit Tunakula",
  offline_payment: "Mobile Money",
  digital_payment: "Carte bancaire",
};

const fmtFc = (n: number) => `${n.toLocaleString("fr-FR")} FC`;

const fmtDate = (d: Date) =>
  d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kinshasa",
  });

export function itemsTotalFc(items: readonly ReceiptItem[]): number {
  return items.reduce((s, i) => s + i.unitPriceFc * i.quantity, 0);
}

export function addonsTotalFc(items: readonly ReceiptItem[]): number {
  return items.reduce(
    (s, i) =>
      s + (i.addons ?? []).reduce((a, x) => a + x.unitPriceFc * x.quantity, 0),
    0,
  );
}

export function renderCustomerReceipt(r: OrderReceipt): string {
  const lines: string[] = [
    `🧾 Reçu — Commande ${r.tkRef} (n° ${r.stackfoodOrderId})`,
    `Date: ${fmtDate(r.placedAt)}`,
    `Restaurant: ${r.restaurantName}`,
    `Type: Livraison · Statut: ${STATUS_MILESTONES[r.status].milestone}`,
    `Paiement: ${PAYMENT_LABELS[r.paymentMethod]} — ${r.paymentStatus === "paid" ? "payé" : "à payer"}`,
    `Référence: ${r.tkRef}`,
    `Couverts: ${r.cutlery ? "Oui" : "Non"}`,
    `———`,
  ];
  for (const item of r.items) {
    lines.push(
      `${item.quantity}× ${item.name} — ${fmtFc(item.unitPriceFc * item.quantity)}`,
    );
    for (const addon of item.addons ?? []) {
      lines.push(
        `   + ${addon.quantity}× ${addon.name} — ${fmtFc(addon.unitPriceFc * addon.quantity)}`,
      );
    }
  }
  lines.push(
    `———`,
    `Articles: ${fmtFc(itemsTotalFc(r.items))}`,
    ...(addonsTotalFc(r.items) > 0
      ? [`Suppléments: ${fmtFc(addonsTotalFc(r.items))}`]
      : []),
    ...(r.discountFc ? [`Remise: -${fmtFc(r.discountFc)}`] : []),
    ...(r.couponFc ? [`Coupon: -${fmtFc(r.couponFc)}`] : []),
    ...(r.dmTipsFc ? [`Pourboire wewa: +${fmtFc(r.dmTipsFc)}`] : []),
    `Frais de service (10%): ${fmtFc(r.fees.serviceFc)}`,
    `Frais de traitement (2%): ${fmtFc(r.fees.processingFc)}`,
    `Livraison: ${fmtFc(r.fees.deliveryFc)}`,
    `Total: ${fmtFc(totalFc(r))}`,
  );
  return lines.join("\n");
}

export function totalFc(r: OrderReceipt): number {
  const gross =
    itemsTotalFc(r.items) +
    addonsTotalFc(r.items) +
    r.fees.serviceFc +
    r.fees.processingFc +
    r.fees.deliveryFc +
    (r.dmTipsFc ?? 0);
  const discount = r.discountFc ?? 0;
  const coupon = r.couponFc ?? 0;
  // A negative discount/coupon would INFLATE the total the customer is
  // charged; a discount larger than the gross would make the total negative
  // (us paying the customer). Neither is ever allowed.
  if (discount < 0 || coupon < 0) {
    throw new Error("discount/coupon cannot be negative");
  }
  const reductions = Math.min(discount + coupon, gross);
  return gross - reductions; // ≥ 0 by construction
}

/**
 * Ops-ledger vocabulary that must never reach a customer message. Used by
 * the guard test; also available as a runtime assertion for new templates.
 */
export const OPS_ONLY_TERMS = [
  "marge",
  "coût ia",
  "couverture",
  "token",
  "llm",
  "70%",
  "30%",
  "float",
] as const;

export function assertCustomerSafe(message: string): void {
  const low = message.toLowerCase();
  for (const term of OPS_ONLY_TERMS) {
    if (low.includes(term)) {
      throw new Error(`ops-only term "${term}" in customer-facing message`);
    }
  }
}
