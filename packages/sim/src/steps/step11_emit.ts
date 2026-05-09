// Step 11 — Hash + tick emit. ADR-0003 §4.3 + §6.2.
// `tick_hash = blake3(prevHash || canonicalJson(events) || canonicalJson(stateDelta))`

import { canonicalJson } from "../canonical";
import { chainHash } from "../hash";
import type { BrandState, LedgerEntry, SimState, TickEvent, TickRecord } from "../types";

export function step11_emit(
  state: SimState,
  events: ReadonlyArray<TickEvent>,
  ledgerDelta: ReadonlyArray<LedgerEntry>,
  prevHash: string,
): { hash: string; record: TickRecord } {
  const stateSummary: TickRecord["stateSummary"] = Object.freeze({
    cashCents: state.brand.cashCents,
    rating30Scaled: state.brand.rating30Scaled,
    consecutiveNegativeCashDays: state.brand.consecutiveNegativeCashDays,
    bankrupt: state.brand.bankrupt,
    weather: state.world.weather,
  });
  const stateDelta = {
    dayIndex: state.dayIndex,
    brand: serializeBrand(state.brand),
    world: state.world,
    ledgerDelta: ledgerDelta.map((l) => ({
      tickIndex: l.tickIndex,
      locationId: l.locationId,
      category: l.category,
      amountCents: l.amountCents,
    })),
  };
  const hash = chainHash(prevHash, canonicalJson(events), canonicalJson(stateDelta));
  const record: TickRecord = Object.freeze({
    tickIndex: state.dayIndex,
    engineVersion: state.engineVersion,
    tickHash: hash,
    events: Object.freeze([...events]),
    ledger: Object.freeze([...ledgerDelta]),
    stateSummary,
  });
  return { hash, record };
}

function serializeBrand(brand: BrandState) {
  return {
    cashCents: brand.cashCents,
    reputationScaled: brand.reputationScaled,
    rating30Scaled: brand.rating30Scaled,
    consecutiveNegativeCashDays: brand.consecutiveNegativeCashDays,
    bankrupt: brand.bankrupt,
  };
}
