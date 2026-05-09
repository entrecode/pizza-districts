// Public entry point for the determinism harness package. Engineers wire
// these into CI jobs; tests reach into individual modules directly.

export { canonicalJson, CanonicalJsonError } from "./canonical";
export {
  streamRng,
  pcg32FromU64,
  pcg32FromU64Pair,
  deriveU64,
  brandSeed,
  daySeed,
  aiSeedFor,
  poiSeedFor,
  reviewSeedFor,
  RESERVED_STREAM_IDS,
  type StreamRng,
  type StreamId,
  type Pcg32,
} from "./streams";
export { validateFixture, FixtureValidationError } from "./validateFixture";
export {
  compareTickChains,
  diffJsonPointers,
  type ChainComparison,
  type ChainDivergence,
  type PointerDiff,
  type TickChainRow,
} from "./compare";
export {
  runDeterminismHarness,
  sha256Hex,
  type HarnessOptions,
  type HarnessResult,
} from "./runHarness";
export type { FixtureFile, HarnessRunArtifacts } from "./types";
