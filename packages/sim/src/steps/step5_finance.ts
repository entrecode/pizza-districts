// Step 5 — Sales / COGS / rent / payroll. No RNG. ADR-0003 §6.2.
// Money is stored as integer cents.

import type { BrandState, LedgerEntry, LocationState, TickEvent } from "../types";

const PRICE_PER_PIZZA_CENTS = 999;
const COGS_PER_PIZZA_CENTS = 320;
const RENT_PER_LOCATION_WEEKLY_CENTS = 30000;
const PAYROLL_PER_LOCATION_DAILY_CENTS = 8000;

export function step5_finance(
  brand: BrandState,
  locations: ReadonlyArray<LocationState>,
  dayIndex: number,
  weeklyPeriodDays: number,
): { events: TickEvent[]; ledgerDelta: LedgerEntry[] } {
  const events: TickEvent[] = [];
  const ledgerDelta: LedgerEntry[] = [];
  const sortedLocations = [...locations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let totalRevenue = 0;
  let totalCogs = 0;
  let totalRent = 0;
  let totalPayroll = 0;
  const isRentDay = dayIndex > 0 && dayIndex % weeklyPeriodDays === 0;
  for (const loc of sortedLocations) {
    const revenue = loc.lastSales * PRICE_PER_PIZZA_CENTS;
    const cogs = loc.lastSales * COGS_PER_PIZZA_CENTS;
    const payroll = PAYROLL_PER_LOCATION_DAILY_CENTS;
    const rent = isRentDay ? RENT_PER_LOCATION_WEEKLY_CENTS : 0;
    if (revenue > 0) {
      ledgerDelta.push({
        tickIndex: dayIndex,
        locationId: loc.id,
        category: "sales",
        amountCents: revenue,
      });
    }
    if (cogs > 0) {
      ledgerDelta.push({
        tickIndex: dayIndex,
        locationId: loc.id,
        category: "cogs",
        amountCents: -cogs,
      });
    }
    ledgerDelta.push({
      tickIndex: dayIndex,
      locationId: loc.id,
      category: "payroll",
      amountCents: -payroll,
    });
    if (rent > 0) {
      ledgerDelta.push({
        tickIndex: dayIndex,
        locationId: loc.id,
        category: "rent",
        amountCents: -rent,
      });
    }
    totalRevenue += revenue;
    totalCogs += cogs;
    totalRent += rent;
    totalPayroll += payroll;
  }
  const net = totalRevenue - totalCogs - totalRent - totalPayroll;
  brand.cashCents += net;
  events.push({
    kind: "finance_settled",
    tickIndex: dayIndex,
    payload: {
      revenue: totalRevenue,
      cogs: totalCogs,
      rent: totalRent,
      payroll: totalPayroll,
      net,
      cashCents: brand.cashCents,
    },
  });
  return { events, ledgerDelta };
}
