// Step 3 — Marketing budget consumption + decay. No RNG. ADR-0003 §6.2.
// Runs *before* demand so today's awareness reflects today's spend.
// LUT-dependent decay path is gated on `LUT_READY`; identity behavior otherwise.

import type { LookupTables, MarketingCampaign, TickEvent } from "../types";

export function step3_marketing(
  marketing: MarketingCampaign[],
  marketingDecayPerDay: number, // integer-scaled, 10000 = no decay
  dayIndex: number,
  luts: LookupTables,
): { events: TickEvent[] } {
  const events: TickEvent[] = [];
  marketing.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const c of marketing) {
    if (c.active && c.remainingBudget > 0) {
      // Daily spend slice = min(remaining, 100 cents) for the scaffold.
      const spend = Math.min(c.remainingBudget, 100);
      c.remainingBudget -= spend;
      // Awareness growth — when LUTs land, this consumes oneMinusExpNegQ16.
      const growth = luts.LUT_READY
        ? // round(1_000_000 × (1 - exp(-spend / S0))) via LUT[0..N-1]
          Math.min(1_000_000, c.reach + (luts.oneMinusExpNegQ16[0] ?? 0))
        : Math.min(1_000_000, c.reach + 1000);
      c.reach = growth;
      if (c.remainingBudget === 0) c.active = false;
    } else if (c.reach > 0) {
      // Decay: integer-scaled multiply, rounded down to keep determinism.
      const next = Math.floor((c.reach * marketingDecayPerDay) / 10000);
      if (next !== c.reach) {
        events.push({
          kind: "marketing_decay",
          tickIndex: dayIndex,
          campaignId: c.id,
          payload: { from: c.reach, to: next },
        });
        c.reach = next;
      }
    }
  }
  return { events };
}
