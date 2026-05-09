// streamRng — substream factory for the simulation determinism harness.
//
// Mirrors the engine convention from
// [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §3:
//
//   1. The caller assembles a `seed_recipe` string per the formula sheet, e.g.
//        `hash(day_seed, location_id, "arrivals")` rendered as
//        `"<day_seed>:<location_id>:arrivals"`.
//      The harness does NOT prescribe the recipe format — that is the formula
//      sheet's contract. We hash whatever bytes the caller provides.
//   2. SHA-256 the recipe bytes (UTF-8).
//   3. Take the first 8 bytes of the digest, interpret as a little-endian u64.
//      That u64 is the PCG32 seed for this substream.
//   4. Initialize PCG32 with `seed = u64`, `inc = PCG32_DEFAULT_INC`.
//
// Reference vectors live under `packages/sim-test/reference-vectors/streams.json`
// and the engine MUST match them byte-for-byte. PCG32 spec from O'Neill 2014
// (https://www.pcg-random.org/), default-stream variant.
//
// All u64 arithmetic uses BigInt and is masked to 64 bits at every step. Output
// is a 32-bit unsigned integer returned as a JS Number in `[0, 2^32)`.

import { createHash } from "node:crypto";

const PCG_MULT = 6364136223846793005n;

/**
 * PCG32 default increment (Knuth's golden constant, odd). The engine uses
 * the same value — see `packages/sim-test/seeding-protocol.md`.
 */
export const PCG32_DEFAULT_INC = 1442695040888963407n;

const U64_MASK = 0xffffffffffffffffn;
const U32_MASK = 0xffffffffn;

export interface StreamRng {
  /** Next 32-bit unsigned integer in [0, 2^32). */
  nextU32(): number;
  /** Next IEEE-754 double in [0, 1) with 32-bit precision. */
  nextFloat01(): number;
  /** Returns the 64-bit state as a BigInt (for diagnostics & vector capture). */
  peekState(): bigint;
}

/**
 * Build a substream RNG for a given recipe string.
 *
 * @param seedRecipe the canonical recipe string per the formula sheet.
 * @returns a deterministic PCG32 substream.
 */
export function streamRng(seedRecipe: string): StreamRng {
  const seedU64 = sha256ToU64Le(seedRecipe);
  return pcg32(seedU64, PCG32_DEFAULT_INC);
}

/**
 * SHA-256 the input (UTF-8) and return the first 8 bytes as a little-endian u64.
 *
 * Exposed for tests and so engine and harness can cross-check the seed value
 * before it enters PCG32.
 */
export function sha256ToU64Le(input: string): bigint {
  const digest = createHash("sha256").update(input, "utf8").digest();
  return readU64Le(digest, 0);
}

/**
 * PCG32 generator. State and increment are u64; output is u32.
 *
 * Reference: O'Neill 2014, the canonical `pcg32_random_r` function. The
 * advance step uses the OLD state for output and writes the new state back.
 */
export function pcg32(seed: bigint, inc: bigint = PCG32_DEFAULT_INC): StreamRng {
  // PCG requires inc to be odd. Force it.
  const oddInc = (inc | 1n) & U64_MASK;
  let state = seed & U64_MASK;
  // Burn-in tick so the first output is independent of low-bit seed structure.
  state = (state * PCG_MULT + oddInc) & U64_MASK;
  return {
    nextU32(): number {
      const old = state;
      state = (state * PCG_MULT + oddInc) & U64_MASK;
      // xorshifted = ((old >> 18) ^ old) >> 27, all u32-masked.
      const xorshifted = (((old >> 18n) ^ old) >> 27n) & U32_MASK;
      const rot = Number((old >> 59n) & 31n);
      const left = Number(xorshifted >> BigInt(rot));
      const right = Number((xorshifted << BigInt((32 - rot) & 31)) & U32_MASK);
      return (left | right) >>> 0;
    },
    nextFloat01(): number {
      return this.nextU32() / 4294967296;
    },
    peekState(): bigint {
      return state;
    },
  };
}

function readU64Le(buf: Buffer, offset: number): bigint {
  // Manual little-endian assembly — Node's readBigUInt64LE matches but we
  // assemble bytewise so the engine port (Edge runtime, browser) can mirror
  // the exact same op without depending on Buffer.
  let v = 0n;
  for (let i = 7; i >= 0; i -= 1) {
    v = (v << 8n) | BigInt(buf[offset + i]!);
  }
  return v & U64_MASK;
}
