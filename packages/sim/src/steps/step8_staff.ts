// Step 8 — Staff fatigue + churn. ADR-0003 §6.2.
//
// Reserved no-op in v0.5/v0.6. The stream id `staff` is reserved so that a
// future v0.6+ implementation can turn this on without shifting any other
// step's RNG draws and breaking replay byte-equality.

import type { TickEvent } from "../types";

export function step8_staff(): { events: TickEvent[] } {
  return { events: [] };
}
