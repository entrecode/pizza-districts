// Structural clone for SimState. Avoids `structuredClone` so the bigint values
// in seeds round-trip cleanly and the clone behaviour is identical across
// Node + Deno + browsers without polyfill drift.

import type { SimState } from "./types";

export function cloneSimState(state: SimState): SimState {
  return {
    engineVersion: state.engineVersion,
    worldSeed: state.worldSeed,
    brandSeed: state.brandSeed,
    constants: state.constants,
    dayIndex: state.dayIndex,
    world: { ...state.world },
    brand: { ...state.brand },
    locations: state.locations.map((l) => ({ ...l })),
    marketing: state.marketing.map((m) => ({ ...m })),
    ai: state.ai.map((a) => ({ ...a })),
    ledger: state.ledger.map((l) => ({ ...l })),
  };
}
