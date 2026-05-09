// Step 4 — Demand per location. ADR-0003 §6.2.
// Stream: `arrivals`, seeded with `hash(day_seed, location_id, 'arrivals')`.
// LUT-dependent paths (`price_pull`, `marketing_uplift`) gate on `LUT_READY`;
// when LUTs are absent the step records baseline arrivals so the rest of the
// pipeline still produces a stable hash.

import { streamRng } from "../rng";
import type { LocationState, LookupTables, TickEvent } from "../types";

export function step4_demand(
  locations: LocationState[],
  daySeed: bigint,
  dayIndex: number,
  luts: LookupTables,
): { events: TickEvent[] } {
  const events: TickEvent[] = [];
  locations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const loc of locations) {
    const rng = streamRng("arrivals", daySeed, dayIndex, loc.id);
    // Baseline arrivals: 50 ± 25 noise. Real formula uses LUT-driven pull
    // factors and applies the formula-sheet `customer_arrival.formula`.
    const noise = rng.nextIntBelow(51) - 25;
    const baseArrivals = Math.max(0, 50 + noise);
    const arrivals = luts.LUT_READY
      ? Math.floor((baseArrivals * (luts.priceQ12[0] ?? 4096)) / 4096)
      : baseArrivals;
    const served = Math.min(arrivals, loc.capacity);
    const lost = arrivals - served;
    loc.lastSales = served;
    loc.lastServed = served;
    loc.lastLost = lost;
    events.push({
      kind: "demand_resolved",
      tickIndex: dayIndex,
      locationId: loc.id,
      payload: { arrivals, served, lost },
    });
  }
  return { events };
}
