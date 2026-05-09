// Static fixture validation per
// [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §3.1.
//
// Asserts the v0.6 attribute contract for `parcels.location_snapshot.attributes`
// before any tick runs. A v0.5 legacy attribute leak (`resident_density`,
// `competition_pressure`) aborts the harness up front rather than producing a
// silent hash diff downstream.
//
// PIZ-22 originally scoped this guard; it lives here so the harness can call
// it from `runHarness` and so [PIZ-22](/PIZ/issues/PIZ-22)'s negative fixture
// `init-v0_5-attribute-leak.json` can exercise it.

const V06_KEYS = new Set<string>([
  "foot_traffic",
  "purchasing_power",
  "visibility",
  "density",
  "competition",
]);

const V05_FORBIDDEN = new Set<string>(["resident_density", "competition_pressure"]);

export interface ParcelLike {
  id: string;
  location_snapshot?: {
    attributes?: Record<string, unknown>;
  };
}

export interface FixtureLike {
  parcels?: readonly ParcelLike[];
}

export class FixtureValidationError extends Error {
  override name = "FixtureValidationError";
}

/**
 * Validates a loaded fixture against the v0.6 attribute contract. Throws
 * `FixtureValidationError` with a message containing `v0.5 attribute leak`
 * when any parcel has a forbidden or unknown key — required by the negative
 * test in §3.1.
 */
export function validateFixture(state: unknown): void {
  if (state == null || typeof state !== "object") {
    throw new FixtureValidationError("[harness] fixture is not a SimState object");
  }
  const parcels = (state as FixtureLike).parcels;
  if (!Array.isArray(parcels)) {
    // Phase-1 fixtures may not yet have parcels — that is fine. The guard
    // only fires on present-but-bad data.
    return;
  }
  for (const p of parcels) {
    const attrs = p?.location_snapshot?.attributes ?? {};
    const keys = Object.keys(attrs);
    const bad = keys.filter((k) => V05_FORBIDDEN.has(k) || !V06_KEYS.has(k));
    if (bad.length > 0) {
      throw new FixtureValidationError(
        `[harness] v0.5 attribute leak in parcel ${p.id}: ${bad.join(", ")} — fixture must use v0.6 keys (foot_traffic, purchasing_power, visibility, density, competition).`,
      );
    }
  }
}
