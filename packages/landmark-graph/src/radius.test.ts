import { describe, expect, it } from "vitest";
import {
  classifyZone,
  discoveryList,
  radiusGate,
  ZONE_DELIVERY_FC,
  type RestaurantCandidate,
} from "./radius.js";
import { renderAddress, reinforce, toStackFoodAddressFields } from "./graph.js";
import type { LandmarkAddress } from "./types.js";

const RESTOS: RestaurantCandidate[] = [
  { id: 1, name: "Mama Kito", quartier: "Bandal", distanceKm: 1.2, landmarkHops: 2, sameQuartier: true, sameCommune: true, cuisineCategory: "grillades", open: true, rating: 4.8 },
  { id: 2, name: "Chez Nono", quartier: "Bandal", distanceKm: 2.8, landmarkHops: 4, sameQuartier: true, sameCommune: true, cuisineCategory: "poisson", open: true, rating: 4.6 },
  { id: 3, name: "La Kinoise", quartier: "Ngiri-Ngiri", distanceKm: 4.6, landmarkHops: 6, sameQuartier: false, sameCommune: false, cuisineCategory: "local", open: true, rating: 4.5 },
  { id: 4, name: "Le Gombe Grill", quartier: "Gombe", distanceKm: 7.9, landmarkHops: 11, sameQuartier: false, sameCommune: false, cuisineCategory: "grillades", open: true, rating: 4.7 },
];

describe("5 km rule (FR-R1..R5)", () => {
  it("excludes out-of-radius restaurants from discovery, sorted by distance", () => {
    const list = discoveryList(RESTOS, { rainMode: false });
    expect(list.map((r) => r.name)).toEqual([
      "Mama Kito",
      "Chez Nono",
      "La Kinoise",
    ]);
  });

  it("blocks beyond 5 km with a warm refusal and category-matched substitute (FR-R4)", () => {
    const gombe = RESTOS[3]!;
    const result = radiusGate("discovery", gombe, RESTOS, { rainMode: false });
    expect(result.allowed).toBe(false);
    expect(result.substitute?.name).toBe("Mama Kito");
    expect(result.refusalMessage).toContain("7,9 km");
    expect(result.refusalMessage).toContain("Mama Kito");
  });

  it("enforces the same gate at placement and dispatch (FR-R2/R3)", () => {
    const gombe = RESTOS[3]!;
    for (const gate of ["placement", "dispatch"] as const) {
      expect(radiusGate(gate, gombe, RESTOS, { rainMode: false }).allowed).toBe(
        false,
      );
    }
  });

  it("rain mode shrinks the radius to 3 km (FR-R5)", () => {
    const kinoise = RESTOS[2]!; // 4.6 km — fine normally, blocked in rain
    expect(
      radiusGate("discovery", kinoise, RESTOS, { rainMode: false }).allowed,
    ).toBe(true);
    const rained = radiusGate("discovery", kinoise, RESTOS, { rainMode: true });
    expect(rained.allowed).toBe(false);
    expect(rained.radiusKm).toBe(3);
    expect(discoveryList(RESTOS, { rainMode: true }).map((r) => r.name)).toEqual(
      ["Mama Kito", "Chez Nono"],
    );
  });
});

describe("delivery zones (§8)", () => {
  it("classifies Zone 1/2/3 and pins the FC tariffs", () => {
    expect(classifyZone(RESTOS[0]!)).toBe(1); // same quartier, ≤3 hops
    expect(classifyZone(RESTOS[1]!)).toBe(2); // same commune, >3 hops
    expect(classifyZone(RESTOS[2]!)).toBe(3); // cross-commune
    expect(ZONE_DELIVERY_FC).toEqual({ 1: 3500, 2: 5000, 3: 7000 });
  });
});

describe("landmark graph (FR-L1..L4)", () => {
  const adresse: LandmarkAddress = {
    commune: "Bandalungwa",
    quartier: "Bandal",
    avenue: "2e avenue",
    landmarks: ["après l'église Sainte-Anne"],
    microCue: "portail vert",
    centroid: { lat: -4.3419, lng: 15.2663 },
    weight: 1,
  };

  it("renders the landmark chain, never raw coordinates (FR-L3)", () => {
    expect(renderAddress(adresse)).toBe(
      "Bandal, 2e avenue, après l'église Sainte-Anne, portail vert",
    );
  });

  it("maps to StackFood address fields (Flow 2)", () => {
    const fields = toStackFoodAddressFields(adresse, "+243810000047");
    expect(fields).toMatchObject({
      address: "Bandal, 2e avenue, après l'église Sainte-Anne, portail vert",
      latitude: "-4.3419",
      longitude: "15.2663",
      road: "2e avenue",
      house: "portail vert",
      contact_person_number: "+243810000047",
    });
  });

  it("reinforces confirmed deliveries and appends new micro-cues (FR-L4)", () => {
    const next = reinforce(adresse, "en face de la pharmacie Mère Teresa");
    expect(next.weight).toBe(2);
    expect(next.microCue).toBe("en face de la pharmacie Mère Teresa");
    expect(next.landmarks).toContain("portail vert");
  });
});
