/**
 * Landmark Graph — FR-L1..L4. Kinshasa navigates by landmarks, not streets:
 * addresses are stored as graph nodes (quartier → avenue → landmark →
 * micro-cue) with a centroid lat/lng for StackFood.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LandmarkAddress {
  commune: string;
  quartier: string;
  /** Avenue or road descriptor — maps to StackFood `road`. */
  avenue?: string;
  /** Ordered landmark chain, coarse → fine. */
  landmarks: string[];
  /** Door-level descriptor («portail vert») — maps to StackFood `house`. */
  microCue?: string;
  centroid: LatLng;
  /**
   * Reinforcement weight (FR-L4): successful deliveries strengthen the
   * chain; used to prefer proven renderings.
   */
  weight: number;
}

export type AddressType = "home" | "office" | "others";

/** Delivery zone classification — §8 Order Economics. */
export type DeliveryZone = 1 | 2 | 3;
