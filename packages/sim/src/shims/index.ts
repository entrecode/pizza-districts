// Frozen clock + rng shims. ADR-0003 §4.1 + determinism-harness §7.
//
// Reducer code receives `clock` and `rng` only through these shims. Both are
// `Object.freeze`'d so a step function physically cannot replace `now` with
// `Date.now` or swap the rng for a `Math.random` adapter at runtime. The lint
// rule (sibling issue) covers the static side; this is the runtime guard.

import type { Pcg32 } from "../rng";

export type FrozenClock = Readonly<{
  // dayIndex is the only mutable input; wall-clock time is forbidden.
  readonly dayIndex: number;
}>;

export type FrozenRng = Readonly<{
  readonly nextU32: () => number;
  readonly nextFloat: () => number;
  readonly nextIntBelow: (bound: number) => number;
}>;

export function freezeClock(dayIndex: number): FrozenClock {
  if (!Number.isInteger(dayIndex) || dayIndex < 0) {
    throw new Error("freezeClock: dayIndex must be a non-negative integer");
  }
  return Object.freeze({ dayIndex });
}

export function freezeRng(rng: Pcg32): FrozenRng {
  return Object.freeze({
    nextU32: rng.nextU32,
    nextFloat: rng.nextFloat,
    nextIntBelow: rng.nextIntBelow,
  });
}
