// Step 6 — Reviews. ADR-0003 §6.2.
// Stream: `reviews`, seeded with `review_seed_for(location, day)`.
// `r_d = round(1 + 4 × satisfaction)` per formula sheet; satisfaction is
// integer-scaled so the per-location result stays deterministic.

import { streamRng } from "../rng";
import { reviewSeedFor } from "../rng/seed";
import type { LocationState, TickEvent } from "../types";

export function step6_reviews(
  locations: LocationState[],
  daySeed: bigint,
  dayIndex: number,
): { events: TickEvent[] } {
  const events: TickEvent[] = [];
  locations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const loc of locations) {
    if (loc.lastSales === 0) continue;
    const seed = reviewSeedFor(daySeed, loc.id, dayIndex);
    const rng = streamRng("reviews", seed, dayIndex, loc.id);
    // Satisfaction proxy: condition + (served / capacity) noise.
    const noise = rng.nextIntBelow(201) - 100; // [-100, +100], scaled × 1
    const satisfactionScaled = Math.min(1000, Math.max(0, loc.conditionScaled + noise));
    // r_d = round(1 + 4 × satisfaction). Satisfaction is /1000; result × 1000.
    const ratingDayScaled = 1000 + Math.floor((4000 * satisfactionScaled) / 1000);
    loc.ratingScaled = ratingDayScaled;
    events.push({
      kind: "review_posted",
      tickIndex: dayIndex,
      locationId: loc.id,
      payload: { satisfactionScaled, ratingDayScaled },
    });
  }
  return { events };
}
