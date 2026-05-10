import { RAW_GOOGLE_PLACE_NAMES_FOR_QA } from "./raw-fixture";

export type ParcelSnapshotPoi = {
  id: string;
  lat: number;
  lng: number;
  archetypeId: string;
  label: string;
  category: string;
};

export type ParcelSnapshotResponse = {
  parcelId: string;
  center: { lat: number; lng: number };
  pois: ParcelSnapshotPoi[];
};

const ARCHETYPES = [
  { archetypeId: "food-quick", label: "Quick-service food — zone A", category: "food_service" },
  { archetypeId: "food-casual", label: "Casual dining — cluster B", category: "food_service" },
  { archetypeId: "beverage", label: "Beverage anchor — strip C", category: "beverage" },
  { archetypeId: "competition", label: "Competition pressure — node D", category: "competition" },
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic PRNG (0..1) seeded from parcel id — matches simulation discipline. */
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Phase 1 snapshot: deterministic POIs around a parcel center. Internally we *conceptually*
 * align raw Places names to rows (for QA fixtures), but only archetype labels hit the wire.
 */
export function buildParcelSnapshotResponse(parcelId: string): ParcelSnapshotResponse {
  const rand = mulberry32(hashString(parcelId));
  const n = 3 + Math.floor(rand() * 5);

  const baseLat = 37.7749 + (rand() - 0.5) * 0.04;
  const baseLng = -122.4194 + (rand() - 0.5) * 0.04;

  const pois: ParcelSnapshotPoi[] = [];

  for (let i = 0; i < n; i++) {
    const archetype = ARCHETYPES[i % ARCHETYPES.length]!;
    // Simulate an internal Places row (never exposed). Names come only from the QA fixture pool.
    const _simulatedRawName = RAW_GOOGLE_PLACE_NAMES_FOR_QA[i % RAW_GOOGLE_PLACE_NAMES_FOR_QA.length];
    void _simulatedRawName;

    const lat = baseLat + (rand() - 0.5) * 0.012;
    const lng = baseLng + (rand() - 0.5) * 0.012;

    pois.push({
      id: `poi:${parcelId}:${i}`,
      lat,
      lng,
      archetypeId: archetype.archetypeId,
      label: archetype.label,
      category: archetype.category,
    });
  }

  return {
    parcelId,
    center: { lat: baseLat, lng: baseLng },
    pois,
  };
}
