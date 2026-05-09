// Re-export the engine's RNG surface so the harness and the engine share
// one byte-level contract. ADR-0003 §4.1 / determinism-harness §3.
//
// The engine's `streamRng(streamId, seed, dayIndex, ...extra)` is a
// structured-tuple recipe; it differs from the harness scaffold's earlier
// single-string recipe (PIZ-48 follow-up). PCG seeding init is the
// engine's two-step convention, also documented in PIZ-48.

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
} from "@pd/sim";
