// Code-defined fixtures that produce valid `SimState` objects for the
// engine's `replay()` entry point. Lives in TS rather than JSON because the
// engine's SimState carries `bigint` fields (worldSeed, brandSeed) that JSON
// cannot represent natively.
//
// Each factory returns a fresh state on every call so test cases can mutate
// without leaking across runs.

import type { SimState } from "@pd/sim";

import type { FixtureFile } from "../types";

const ENGINE_VERSION = 1;

const DEFAULT_CONSTANTS: SimState["constants"] = Object.freeze({
  bankruptcyWindowDays: 14,
  rollingWindow: 30,
  weeklyPeriodDays: 7,
  marketingDecayPerDay: 9700,
});

function freshState(overrides: Partial<SimState> = {}): SimState {
  return {
    engineVersion: ENGINE_VERSION,
    worldSeed: 0xc0ffeen,
    brandSeed: 0xc0ffeen,
    constants: DEFAULT_CONSTANTS,
    dayIndex: 0,
    world: { weather: 0, weatherDay: 0 },
    brand: {
      cashCents: 5_000_000,
      reputationScaled: 500,
      rating30Scaled: 4_000,
      consecutiveNegativeCashDays: 0,
      bankrupt: false,
    },
    locations: [
      {
        id: "loc_1",
        capacity: 100,
        conditionScaled: 750,
        ratingScaled: 4_000,
        lastSales: 0,
        lastServed: 0,
        lastLost: 0,
      },
    ],
    marketing: [],
    ai: [],
    ledger: [],
    ...overrides,
  };
}

export function fixtureFreshBrand(): FixtureFile {
  return {
    id: "init-fresh-brand",
    brand_seed_hex: "0xC0FFEE",
    initial_state: freshState(),
  };
}

export function fixtureNearBankrupt(): FixtureFile {
  return {
    id: "init-near-bankrupt",
    brand_seed_hex: "0xDEAD01",
    initial_state: freshState({
      worldSeed: 0xdead01n,
      brandSeed: 0xdead01n,
      brand: {
        cashCents: -100,
        reputationScaled: 250,
        rating30Scaled: 2_500,
        consecutiveNegativeCashDays: 13,
        bankrupt: false,
      },
      locations: [
        {
          id: "loc_1",
          capacity: 100,
          conditionScaled: 500,
          ratingScaled: 2_500,
          lastSales: 0,
          lastServed: 0,
          lastLost: 0,
        },
      ],
    }),
  };
}

export function fixtureThreeLocations(): FixtureFile {
  return {
    id: "init-three-locations",
    brand_seed_hex: "0xBEEF01",
    initial_state: freshState({
      worldSeed: 0xbeef01n,
      brandSeed: 0xbeef01n,
      locations: ["loc_a", "loc_b", "loc_c"].map((id) => ({
        id,
        capacity: 100,
        conditionScaled: 750,
        ratingScaled: 4_000,
        lastSales: 0,
        lastServed: 0,
        lastLost: 0,
      })),
    }),
  };
}
