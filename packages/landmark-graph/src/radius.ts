import type { DeliveryZone } from "./types.js";

/**
 * The 5 km rule — FR-R1..R5. Distance is expressed in landmark-ring hops and
 * km; the same gate logic runs at discovery, placement and dispatch. Rain
 * mode shrinks the radius to 3 km globally.
 */

export const RADIUS_KM = 5;
export const RAIN_RADIUS_KM = 3;

export interface RadiusConfig {
  rainMode: boolean;
}

export function effectiveRadiusKm(cfg: RadiusConfig): number {
  return cfg.rainMode ? RAIN_RADIUS_KM : RADIUS_KM;
}

export interface RestaurantCandidate {
  id: number;
  name: string;
  quartier: string;
  /** Hop-based distance from the customer centroid (FR-R1). */
  distanceKm: number;
  landmarkHops: number;
  sameQuartier: boolean;
  sameCommune: boolean;
  cuisineCategory: string;
  open: boolean;
  rating: number;
}

export type GateName = "discovery" | "placement" | "dispatch";

export interface GateResult {
  allowed: boolean;
  gate: GateName;
  radiusKm: number;
  /** Category-matched substitute within radius when blocked (FR-R4). */
  substitute?: RestaurantCandidate;
  /** Warm refusal copy, ready to send (French, Kinois register). */
  refusalMessage?: string;
}

/** FR-R1/R2/R3 — one gate implementation, three call sites. */
export function radiusGate(
  gate: GateName,
  candidate: RestaurantCandidate,
  all: readonly RestaurantCandidate[],
  cfg: RadiusConfig,
): GateResult {
  const radiusKm = effectiveRadiusKm(cfg);
  if (candidate.distanceKm <= radiusKm) {
    return { allowed: true, gate, radiusKm };
  }
  const substitute = findSubstitute(candidate, all, radiusKm);
  return {
    allowed: false,
    gate,
    radiusKm,
    substitute,
    refusalMessage: refusalCopy(candidate, substitute, radiusKm),
  };
}

/** FR-R1 discovery list: within radius, open, sorted by distance. */
export function discoveryList(
  all: readonly RestaurantCandidate[],
  cfg: RadiusConfig,
): RestaurantCandidate[] {
  const radiusKm = effectiveRadiusKm(cfg);
  return all
    .filter((r) => r.open && r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function findSubstitute(
  blocked: RestaurantCandidate,
  all: readonly RestaurantCandidate[],
  radiusKm: number,
): RestaurantCandidate | undefined {
  return all
    .filter(
      (r) =>
        r.id !== blocked.id &&
        r.open &&
        r.distanceKm <= radiusKm &&
        r.cuisineCategory === blocked.cuisineCategory,
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}

/** FR-R4: the rule must convert, not just deny. */
function refusalCopy(
  blocked: RestaurantCandidate,
  substitute: RestaurantCandidate | undefined,
  radiusKm: number,
): string {
  const base =
    `🚫 ${blocked.name} est à ${formatKm(blocked.distanceKm)} km. ` +
    `Au-delà de ${radiusKm} km à Kin, ton plat arrive froid et ton wewa ` +
    `reste coincé dans les embouteillages 😅`;
  if (!substitute) return base;
  return (
    base +
    `\nMême style tout près: ${substitute.name} — ` +
    `${formatKm(substitute.distanceKm)} km ⭐${substitute.rating}`
  );
}

function formatKm(km: number): string {
  return km.toFixed(1).replace(".", ",");
}

/**
 * Zone classification for delivery fees — §8. Zone 1: same quartier and
 * ≤ 3 landmark hops. Zone 2: adjacent quartier / same commune. Zone 3:
 * cross-commune, still inside the radius.
 */
export function classifyZone(c: RestaurantCandidate): DeliveryZone {
  if (c.sameQuartier && c.landmarkHops <= 3) return 1;
  if (c.sameCommune) return 2;
  return 3;
}

/** Zone tariffs in FC — configured identically in StackFood admin. */
export const ZONE_DELIVERY_FC: Record<DeliveryZone, number> = {
  1: 3500,
  2: 5000,
  3: 7000,
};
