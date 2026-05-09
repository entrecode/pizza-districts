// RNG entry point for the reducer. ADR-0003 §4.1.
//
// Reserved stream ids (must match the formula-sheet recipes):
//   arrivals | weather | reviews | ai_moves | events | staff | marketing_noise
//
// `streamRng(streamId, seed, day_index)` constructs a fresh PCG32 keyed on
// `(seed, streamId, day_index)` so no global RNG state crosses tick boundaries.

import { pcg32FromU64, type Pcg32 } from "./pcg32";
import { deriveU64 } from "./seed";

export const RESERVED_STREAM_IDS = [
  "arrivals",
  "weather",
  "reviews",
  "ai_moves",
  "events",
  "staff",
  "marketing_noise",
] as const;

export type StreamId = (typeof RESERVED_STREAM_IDS)[number];

const RESERVED_SET: ReadonlySet<string> = new Set(RESERVED_STREAM_IDS);

export type StreamRng = Pcg32;

export function streamRng(
  streamId: StreamId,
  seed: bigint,
  dayIndex: number,
  ...extra: Array<string | number | bigint>
): StreamRng {
  if (!RESERVED_SET.has(streamId)) {
    throw new Error(`streamRng: unknown stream id ${String(streamId)}`);
  }
  const u64 = deriveU64("stream", streamId, seed, dayIndex, ...extra);
  return pcg32FromU64(u64);
}

export { pcg32FromU64, pcg32FromU64Pair, type Pcg32 } from "./pcg32";
export { deriveU64, brandSeed, daySeed, aiSeedFor, poiSeedFor, reviewSeedFor } from "./seed";
