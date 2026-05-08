// Step 10 — Narrative events (UI feed). ADR-0003 §6.2.
// Stream: `events`. Aggregates noteworthy facts from the tick into narrative
// rows. Pure: derives from the tick's already-computed events.

import type { BrandState, TickEvent } from "../types";

export function step10_events(
  brand: BrandState,
  collectedEvents: ReadonlyArray<TickEvent>,
  dayIndex: number,
): { events: TickEvent[] } {
  const events: TickEvent[] = [];
  // Surface a narrative milestone whenever finance pushed cash below zero or
  // the rating window crossed a 1.0-point boundary. Both signals are already
  // on `collectedEvents`; we just promote them.
  for (const e of collectedEvents) {
    if (e.kind === "finance_settled" && typeof e.payload.cashCents === "number") {
      if (e.payload.cashCents < 0 && brand.consecutiveNegativeCashDays === 1) {
        events.push({
          kind: "narrative",
          tickIndex: dayIndex,
          payload: { headline: "cash_negative", cashCents: e.payload.cashCents },
        });
      }
    }
    if (e.kind === "rating_updated" && typeof e.payload.to === "number") {
      const to = e.payload.to;
      const from = typeof e.payload.from === "number" ? e.payload.from : to;
      if (Math.floor(to / 1000) !== Math.floor(from / 1000)) {
        events.push({
          kind: "narrative",
          tickIndex: dayIndex,
          payload: { headline: "rating_band_changed", from, to },
        });
      }
    }
  }
  return { events };
}
