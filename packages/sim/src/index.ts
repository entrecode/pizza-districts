// @pd/sim — pure deterministic simulation engine. ADR-0003.
//
// No I/O, no Date.now(), no Math.random(). All randomness flows from the
// seeded PCG32 (rng/) and named-seed recipes (rng/seed.ts). All time flows
// from the explicit `tickIndex` input. The 11 canonical steps are exported as
// standalone functions so the determinism harness §6.4 can target each one in
// isolation; `runTick` composes them in canonical order; `replay` chains the
// per-tick hash forward.

export { runTick } from "./runTick";
export { replay, type ReplaySnapshot } from "./replay";

export {
  step1_weather,
  step2_aiMoves,
  step3_marketing,
  step4_demand,
  step5_finance,
  step6_reviews,
  step7_rating30,
  step8_staff,
  step9_bankruptcy,
  step10_events,
  step11_emit,
  CANONICAL_STEP_ORDER,
  type CanonicalStepName,
} from "./steps";

export {
  pcg32FromU64,
  pcg32FromU64Pair,
  streamRng,
  deriveU64,
  brandSeed,
  daySeed,
  aiSeedFor,
  poiSeedFor,
  reviewSeedFor,
  RESERVED_STREAM_IDS,
  type Pcg32,
  type StreamId,
  type StreamRng,
} from "./rng";

export { freezeClock, freezeRng, type FrozenClock, type FrozenRng } from "./shims";

export {
  expClampedQ12,
  oneMinusExpNegQ16,
  LUTS,
  EXP_CLAMPED_Q12,
  EXP_CLAMPED_Q12_LEN,
  EXP_CLAMPED_Q12_X_MIN_Q10,
  EXP_CLAMPED_Q12_X_MAX_Q10,
  EXP_CLAMPED_Q12_Y_MAX,
  EXP_CLAMPED_Q12_Y_MIN,
  ONE_MINUS_EXP_NEG_Q16,
  ONE_MINUS_EXP_NEG_Q16_LEN,
  ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8,
  ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8,
  ONE_MINUS_EXP_NEG_Q16_Y_MAX,
  ONE_MINUS_EXP_NEG_Q16_Y_MIN,
} from "./lut";

export { canonicalJson } from "./canonical";
export { chainHash, ZERO_HASH } from "./hash";

export type {
  AiCompetitor,
  BrandState,
  LedgerCategory,
  LedgerEntry,
  LocationState,
  LookupTables,
  MarketingCampaign,
  Money,
  RatingScaled,
  RunTickResult,
  SimConstants,
  SimState,
  TickEvent,
  TickEventKind,
  TickInputs,
  TickRecord,
  WeatherCode,
  WorldState,
} from "./types";
export { EMPTY_LUTS } from "./types";
