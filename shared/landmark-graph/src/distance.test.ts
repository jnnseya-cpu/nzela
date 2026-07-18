import { describe, expect, it } from "vitest";
import {
  distanceKm,
  nearest,
  rankByDistance,
  resolveCustomerLocation,
} from "./distance.js";
import type { LandmarkAddress } from "./types.js";

// Reference points in Kinshasa.
const BANDAL = { lat: -4.3419, lng: 15.2663 }; // customer, Bandal
const GOMBE = { lat: -4.3054, lng: 15.3132 }; // ~6.6 km away

const RESTOS = [
  { id: 1, name: "Mama Kito", location: { lat: -4.3455, lng: 15.2755 } },
  { id: 2, name: "Chez Nono", location: { lat: -4.3562, lng: 15.2871 } },
  { id: 3, name: "Le Gombe Grill", location: GOMBE },
];

describe("geolocation distance (ERRATA E-4)", () => {
  it("computes haversine distance in km", () => {
    expect(distanceKm(BANDAL, BANDAL)).toBe(0);
    const toGombe = distanceKm(BANDAL, GOMBE);
    expect(toGombe).toBeGreaterThan(5.5);
    expect(toGombe).toBeLessThan(7.5);
  });

  it("ranks restaurants nearest-first from the customer position", () => {
    const customer = { source: "live-geolocation" as const, point: BANDAL };
    const ranked = rankByDistance(customer, RESTOS);
    expect(ranked.map((r) => r.restaurant.name)).toEqual([
      "Mama Kito",
      "Chez Nono",
      "Le Gombe Grill",
    ]);
    expect(nearest(customer, RESTOS)?.restaurant.name).toBe("Mama Kito");
    // Nearest is well inside the 5 km radius; Gombe is outside it.
    expect(ranked[0]!.distanceKm).toBeLessThan(2);
    expect(ranked[2]!.distanceKm).toBeGreaterThan(5);
  });

  it("prefers live geolocation over the saved Adresse Vocale", () => {
    const saved: LandmarkAddress = {
      commune: "Bandalungwa",
      quartier: "Bandal",
      landmarks: ["après Sainte-Anne"],
      centroid: BANDAL,
      weight: 3,
    };
    expect(resolveCustomerLocation(GOMBE, saved)).toEqual({
      source: "live-geolocation",
      point: GOMBE,
    });
    expect(resolveCustomerLocation(undefined, saved)).toEqual({
      source: "adresse-vocale",
      point: BANDAL,
    });
    expect(resolveCustomerLocation(undefined, undefined)).toBeUndefined();
  });
});
