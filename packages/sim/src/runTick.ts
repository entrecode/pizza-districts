// Per-tick reducer. ADR-0003 §8.
// `runTick(state, inputs, prevHash, luts) → { state, events, hash, ledgerDelta }`
//
// `state` is treated immutably from the caller's perspective: we deep-clone on
// entry, mutate the clone through the per-step pipeline, and return the new
// state. The 11 step functions remain individually addressable for the
// determinism harness's per-step §6.4 unit tests.

import { cloneSimState } from "./clone";
import { aiSeedFor, daySeed } from "./rng/seed";
import {
  step10_events,
  step11_emit,
  step1_weather,
  step2_aiMoves,
  step3_marketing,
  step4_demand,
  step5_finance,
  step6_reviews,
  step7_rating30,
  step8_staff,
  step9_bankruptcy,
} from "./steps";
import type {
  LookupTables,
  RunTickResult,
  SimState,
  TickEvent,
  TickInputs,
  TickRecord,
} from "./types";

export function runTick(
  inputState: SimState,
  inputs: TickInputs,
  prevHash: string,
  luts: LookupTables,
): RunTickResult {
  if (!Number.isInteger(inputs.tickIndex) || inputs.tickIndex < 0) {
    throw new Error("runTick: tickIndex must be a non-negative integer");
  }
  const state = cloneSimState(inputState);
  state.dayIndex = inputs.tickIndex;
  const dayIndex = inputs.tickIndex;
  const events: TickEvent[] = [];
  const ledgerDelta: ReturnType<typeof step5_finance>["ledgerDelta"] = [];

  // Step 1 — weather
  const dSeed = daySeed(state.brandSeed, dayIndex);
  events.push(...step1_weather(state.world, dSeed, state.worldSeed, dayIndex).events);

  // Step 2 — AI moves (one stream per AI brand × day)
  for (const ai of state.ai) {
    const aiSeedValue = aiSeedFor(state.worldSeed, ai.id, dayIndex);
    const isolated = [ai];
    events.push(...step2_aiMoves(isolated, aiSeedValue, dayIndex).events);
  }

  // Step 3 — marketing
  events.push(
    ...step3_marketing(
      state.marketing,
      state.constants.marketingDecayPerDay,
      dayIndex,
      luts,
    ).events,
  );

  // Step 4 — demand
  events.push(...step4_demand(state.locations, dSeed, dayIndex, luts).events);

  // Step 5 — finance
  const finance = step5_finance(
    state.brand,
    state.locations,
    dayIndex,
    state.constants.weeklyPeriodDays,
  );
  events.push(...finance.events);
  ledgerDelta.push(...finance.ledgerDelta);

  // Step 6 — reviews
  events.push(...step6_reviews(state.locations, dSeed, dayIndex).events);

  // Step 7 — rating-30 rolling avg
  events.push(
    ...step7_rating30(
      state.brand,
      state.locations,
      state.constants.rollingWindow,
      dayIndex,
    ).events,
  );

  // Step 8 — staff (reserved no-op)
  events.push(...step8_staff().events);

  // Step 9 — bankruptcy
  const bankruptcy = step9_bankruptcy(
    state.brand,
    state.constants.bankruptcyWindowDays,
    dayIndex,
  );
  events.push(...bankruptcy.events);
  ledgerDelta.push(...bankruptcy.ledgerDelta);

  // Step 10 — narrative events
  events.push(...step10_events(state.brand, events, dayIndex).events);

  // Persist ledger delta on state.
  for (const entry of ledgerDelta) state.ledger.push(entry);

  // Step 11 — hash + emit
  const { hash, record } = step11_emit(state, events, ledgerDelta, prevHash);

  return {
    state,
    events: Object.freeze([...events]),
    hash,
    ledgerDelta: Object.freeze([...ledgerDelta]),
    record,
  };
}
