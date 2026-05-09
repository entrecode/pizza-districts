// Public entry point for the determinism harness package. Engineers wire
// these into CI jobs; tests reach into individual modules directly.

export { canonicalJson, canonicalJsonBytes, CanonicalJsonError } from "./canonical";
export { streamRng, pcg32, sha256ToU64Le, PCG32_DEFAULT_INC, type StreamRng } from "./streams";
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
export type {
  EngineApi,
  FixtureFile,
  ReplayCtx,
  RunTickResult,
  SimEvent,
  SimState,
  TickInputs,
  TickRecord,
} from "./types";
