import type { LandmarkAddress, LatLng } from "./types.js";

/**
 * Customer geolocation & restaurant distance — ERRATA E-4.
 *
 * The distance to restaurants is calculated from the customer's
 * geolocation: a live position when they share one (WhatsApp location
 * message, or browser geolocation on the entry page), else the centroid of
 * their saved Adresse Vocale. Landmark hops remain the basis for the
 * zone-fee classification and wewa-facing directions.
 */

export type CustomerLocation =
  | { source: "live-geolocation"; point: LatLng }
  | { source: "adresse-vocale"; point: LatLng };

/** Live position wins; saved Adresse Vocale centroid is the fallback. */
export function resolveCustomerLocation(
  liveGeolocation: LatLng | undefined,
  savedAddress: LandmarkAddress | undefined,
): CustomerLocation | undefined {
  if (liveGeolocation) {
    return { source: "live-geolocation", point: liveGeolocation };
  }
  if (savedAddress) {
    return { source: "adresse-vocale", point: savedAddress.centroid };
  }
  return undefined;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle (haversine) distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export interface LocatedRestaurant {
  id: number;
  name: string;
  location: LatLng;
}

export interface RestaurantWithDistance<T extends LocatedRestaurant> {
  restaurant: T;
  distanceKm: number;
}

/**
 * Distance to every restaurant from the customer's resolved location,
 * nearest first — feeds the discovery list (FR-D2), the Commande Agent's
 * "nearest that has everything" pick (FR-D4), and the radius gates.
 */
export function rankByDistance<T extends LocatedRestaurant>(
  customer: CustomerLocation,
  restaurants: readonly T[],
): RestaurantWithDistance<T>[] {
  return restaurants
    .map((restaurant) => ({
      restaurant,
      distanceKm: distanceKm(customer.point, restaurant.location),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function nearest<T extends LocatedRestaurant>(
  customer: CustomerLocation,
  restaurants: readonly T[],
): RestaurantWithDistance<T> | undefined {
  return rankByDistance(customer, restaurants)[0];
}
