// Step 7 — Rating-30 rolling update. No RNG. ADR-0003 §6.2.
// `rating_30_scaled =
//    ((window-1) * rating_30_scaled_prev + r_d_scaled) / window`
// integer-scaled (× 1 000) per ADR §4.1.

import type { BrandState, LocationState, TickEvent } from "../types";

export function step7_rating30(
  brand: BrandState,
  locations: ReadonlyArray<LocationState>,
  rollingWindow: number,
  dayIndex: number,
): { events: TickEvent[] } {
  const events: TickEvent[] = [];
  if (locations.length === 0) return { events };
  // Aggregate per-day rating across rated locations (sales > 0).
  const rated = locations.filter((l) => l.lastSales > 0);
  if (rated.length === 0) return { events };
  let sum = 0;
  for (const l of rated) sum += l.ratingScaled;
  const dayAvgScaled = Math.floor(sum / rated.length);
  const prev = brand.rating30Scaled;
  const next = Math.floor(((rollingWindow - 1) * prev + dayAvgScaled) / rollingWindow);
  brand.rating30Scaled = next;
  if (next !== prev) {
    events.push({
      kind: "rating_updated",
      tickIndex: dayIndex,
      payload: { from: prev, to: next, dayAvgScaled },
    });
  }
  return { events };
}
