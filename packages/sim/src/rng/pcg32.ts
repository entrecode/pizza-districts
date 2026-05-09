// PCG32 — 64-bit LCG state, 32-bit XSH RR output. ADR-0003 §4.1.
// Pure JS, deterministic across Node + Deno + browsers.

const MULT = 6364136223846793005n;
const DEFAULT_INC = 1442695040888963407n;
const MASK64 = (1n << 64n) - 1n;
const MASK32 = (1n << 32n) - 1n;

export type Pcg32 = {
  readonly nextU32: () => number;
  readonly nextFloat: () => number;
  readonly nextIntBelow: (bound: number) => number;
  readonly state: () => bigint;
};

function makePcg32(initialState: bigint, increment: bigint): Pcg32 {
  // Increment must be odd; force LSB high so the LCG full-period property holds.
  let inc = increment & MASK64;
  if ((inc & 1n) === 0n) inc = (inc | 1n) & MASK64;
  let state = (initialState + inc) & MASK64;
  state = (state * MULT + inc) & MASK64;

  function step(): number {
    const old = state;
    state = (old * MULT + inc) & MASK64;
    const xorshifted = (((old >> 18n) ^ old) >> 27n) & MASK32;
    const rot = Number(old >> 59n) & 31;
    const out = ((xorshifted >> BigInt(rot)) | (xorshifted << BigInt((32 - rot) & 31))) & MASK32;
    return Number(out);
  }

  return Object.freeze({
    nextU32: step,
    nextFloat(): number {
      // 53-bit float in [0, 1) using two 32-bit draws so the mantissa is fully
      // populated; deterministic across runtimes because we never touch the FPU
      // until the final divide.
      const hi = step() >>> 5; // 27 bits
      const lo = step() >>> 6; // 26 bits
      return (hi * 0x4000000 + lo) / 0x20000000000000;
    },
    nextIntBelow(bound: number): number {
      if (!Number.isInteger(bound) || bound <= 0 || bound > 0x100000000) {
        throw new Error("pcg32.nextIntBelow: bound must be an integer in (0, 2^32]");
      }
      // Unbiased rejection sampling per O'Neill (PCG paper §4.6).
      const threshold = (-bound >>> 0) % bound;
      while (true) {
        const r = step();
        if (r >= threshold) return r % bound;
      }
    },
    state(): bigint {
      return state;
    },
  });
}

// Construct a PCG32 seeded by a single u64 derived value.
// The increment is fixed; substream separation is handled by `streamRng` callers
// passing distinct seed inputs (per the formula-sheet recipe).
export function pcg32FromU64(seed: bigint): Pcg32 {
  return makePcg32(seed & MASK64, DEFAULT_INC);
}

// Construct a PCG32 with both state and increment derived (used when callers
// want stream-id-disjoint sequences from the same seed).
export function pcg32FromU64Pair(seed: bigint, streamSelector: bigint): Pcg32 {
  return makePcg32(seed & MASK64, streamSelector & MASK64);
}
