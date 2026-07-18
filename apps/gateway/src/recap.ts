import { ZONE_DELIVERY_FC, type DeliveryZone } from "@nzela/landmark-graph";

/**
 * Order récap / fee breakdown — §8 Order Economics (locked) and FR-E1/E2.
 * The fee model is client-pays: 10% service + 2% processing + zone delivery.
 * StackFood remains the pricing brain at order time; these numbers are the
 * customer-facing récap and must always show the full breakdown before
 * payment. The wewa takes 70% of the delivery fee.
 */

export const SERVICE_FEE_RATE = 0.1;
export const PROCESSING_FEE_RATE = 0.02;
export const WEWA_DELIVERY_SHARE = 0.7;
export const FC_PER_USD = 2800;

export interface FeeBreakdown {
  subtotalFc: number;
  serviceFc: number;
  processingFc: number;
  deliveryFc: number;
  totalFc: number;
  wewaShareFc: number;
  /** Tunakula margin: service + processing + 30% of delivery. */
  margeFc: number;
}

export function feeBreakdown(
  subtotalFc: number,
  zone: DeliveryZone,
  opts: { rainMultiplier?: number } = {},
): FeeBreakdown {
  const serviceFc = Math.round(subtotalFc * SERVICE_FEE_RATE);
  const processingFc = Math.round(subtotalFc * PROCESSING_FEE_RATE);
  const deliveryFc = Math.round(
    ZONE_DELIVERY_FC[zone] * (opts.rainMultiplier ?? 1),
  );
  const wewaShareFc = Math.round(deliveryFc * WEWA_DELIVERY_SHARE);
  return {
    subtotalFc,
    serviceFc,
    processingFc,
    deliveryFc,
    totalFc: subtotalFc + serviceFc + processingFc + deliveryFc,
    wewaShareFc,
    margeFc: serviceFc + processingFc + (deliveryFc - wewaShareFc),
  };
}

const fmtFc = (n: number) => `${n.toLocaleString("fr-FR")} FC`;

/** FR-E2: full breakdown before payment, no hidden fees. */
export function renderRecap(b: FeeBreakdown): string {
  return [
    `Sous-total: ${fmtFc(b.subtotalFc)}`,
    `Frais de service (10%): ${fmtFc(b.serviceFc)}`,
    `Frais de traitement (2%): ${fmtFc(b.processingFc)}`,
    `Livraison: ${fmtFc(b.deliveryFc)}`,
    `Total: ${fmtFc(b.totalFc)}`,
  ].join("\n");
}
