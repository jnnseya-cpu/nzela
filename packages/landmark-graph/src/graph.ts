import type { LandmarkAddress } from "./types.js";

/**
 * Rendering + reinforcement. Wewa-facing directions are landmark chains,
 * never raw coordinates (FR-L3); the rendered string is also what is written
 * into the StackFood `address` field (Flow 2).
 */

export function renderAddress(a: LandmarkAddress): string {
  const parts: string[] = [a.quartier];
  if (a.avenue) parts.push(a.avenue);
  parts.push(...a.landmarks);
  if (a.microCue) parts.push(a.microCue);
  return parts.join(", ");
}

/** StackFood address-field mapping (Integration Spec §4). */
export function toStackFoodAddressFields(
  a: LandmarkAddress,
  contactNumber: string,
  addressType: "home" | "office" | "others" = "home",
): {
  address: string;
  latitude: string;
  longitude: string;
  address_type: string;
  road: string;
  house: string;
  floor: string;
  contact_person_number: string;
} {
  return {
    address: renderAddress(a),
    latitude: a.centroid.lat.toFixed(4),
    longitude: a.centroid.lng.toFixed(4),
    address_type: addressType,
    road: a.avenue ?? "",
    house: a.microCue ?? "",
    floor: "",
    contact_person_number: contactNumber,
  };
}

/**
 * FR-L4: a confirmed delivery strengthens the chain; a fresh micro-cue heard
 * from the wewa is appended for reuse rather than replacing history.
 */
export function reinforce(
  a: LandmarkAddress,
  confirmedMicroCue?: string,
): LandmarkAddress {
  const next: LandmarkAddress = { ...a, weight: a.weight + 1 };
  if (confirmedMicroCue && confirmedMicroCue !== a.microCue) {
    next.landmarks = a.microCue
      ? [...a.landmarks, a.microCue]
      : [...a.landmarks];
    next.microCue = confirmedMicroCue;
  }
  return next;
}
