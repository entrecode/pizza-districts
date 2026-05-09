// Step 9 — Bankruptcy / consecutive-negative-day counter. No RNG. ADR-0003 §6.2.
// `bankruptcy_window_days` from the formula sheet (default 14).

import type { BrandState, LedgerEntry, TickEvent } from "../types";

export function step9_bankruptcy(
  brand: BrandState,
  bankruptcyWindowDays: number,
  dayIndex: number,
): { events: TickEvent[]; ledgerDelta: LedgerEntry[] } {
  const events: TickEvent[] = [];
  const ledgerDelta: LedgerEntry[] = [];
  if (brand.bankrupt) return { events, ledgerDelta };
  if (brand.cashCents < 0) {
    brand.consecutiveNegativeCashDays += 1;
  } else if (brand.consecutiveNegativeCashDays !== 0) {
    brand.consecutiveNegativeCashDays = 0;
  }
  if (brand.consecutiveNegativeCashDays >= bankruptcyWindowDays) {
    brand.bankrupt = true;
    const settlement = brand.cashCents;
    brand.cashCents = 0;
    ledgerDelta.push({
      tickIndex: dayIndex,
      locationId: null,
      category: "settlement",
      amountCents: -settlement, // zero out signed cash
    });
    events.push({
      kind: "bankruptcy",
      tickIndex: dayIndex,
      payload: {
        consecutiveNegativeCashDays: brand.consecutiveNegativeCashDays,
        settlementCents: settlement,
      },
    });
  }
  return { events, ledgerDelta };
}
