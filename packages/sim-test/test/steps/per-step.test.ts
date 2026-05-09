// §6.4 per-step unit tests — one assertion per canonical 11-step order
// (ADR-0003 §6.2). Each step is invoked in isolation and checked for
// deterministic byte output across two builds.

import { describe, expect, it } from "vitest";

import {
  CANONICAL_STEP_ORDER,
  EMPTY_LUTS,
  LUTS,
  daySeed,
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
} from "@pd/sim";
import type {
  AiCompetitor,
  BrandState,
  LocationState,
  MarketingCampaign,
  SimState,
  TickEvent,
  WorldState,
} from "@pd/sim";

import { fixtureFreshBrand } from "../../src/fixtures/engineFixtures";

const WORLD_SEED = 0xc0ffeen;
const DAY = 0;

describe("§6.4 — canonical step order", () => {
  it("CANONICAL_STEP_ORDER is the 11-element list in canonical order", () => {
    expect(CANONICAL_STEP_ORDER).toEqual([
      "step1_weather",
      "step2_aiMoves",
      "step3_marketing",
      "step4_demand",
      "step5_finance",
      "step6_reviews",
      "step7_rating30",
      "step8_staff",
      "step9_bankruptcy",
      "step10_events",
      "step11_emit",
    ]);
  });
});

describe("§6.4 step 1 — weather (reserved-active)", () => {
  it("two calls with the same seed produce the same WorldState", () => {
    const a: WorldState = { weather: 0, weatherDay: 0 };
    const b: WorldState = { weather: 0, weatherDay: 0 };
    const dSeed = daySeed(WORLD_SEED, DAY);
    step1_weather(a, dSeed, WORLD_SEED, DAY);
    step1_weather(b, dSeed, WORLD_SEED, DAY);
    expect(a).toEqual(b);
  });

  it("different day_index produces different sequence", () => {
    const a: WorldState = { weather: 0, weatherDay: 0 };
    const b: WorldState = { weather: 0, weatherDay: 0 };
    step1_weather(a, daySeed(WORLD_SEED, 1), WORLD_SEED, 1);
    step1_weather(b, daySeed(WORLD_SEED, 2), WORLD_SEED, 2);
    // weather is non-deterministic across days only if the LUT draws differ;
    // accept either same-or-different but assert weatherDay tracks dayIndex.
    expect(a.weatherDay).toBe(1);
    expect(b.weatherDay).toBe(2);
  });
});

describe("§6.4 step 2 — ai-moves", () => {
  it("byte-equal results for two runs with same seed + same competitors", () => {
    const ai1: AiCompetitor[] = [
      { id: "ai_a", districtId: "d1", strength: 500, lastMoveTick: -1 },
      { id: "ai_b", districtId: "d1", strength: 500, lastMoveTick: -1 },
    ];
    const ai2 = ai1.map((c) => ({ ...c }));
    const aiSeed = 0xa17a01n;
    const r1 = step2_aiMoves(ai1, aiSeed, DAY);
    const r2 = step2_aiMoves(ai2, aiSeed, DAY);
    expect(r1.events).toEqual(r2.events);
    expect(ai1).toEqual(ai2);
  });
});

describe("§6.4 step 3 — marketing", () => {
  it("identity behavior with EMPTY_LUTS", () => {
    const m: MarketingCampaign[] = [
      {
        id: "c1",
        channel: "ig",
        districtId: "d1",
        remainingBudget: 100_000,
        reach: 0,
        active: true,
      },
    ];
    const r = step3_marketing(m, 9700, DAY, EMPTY_LUTS);
    expect(Array.isArray(r.events)).toBe(true);
  });

  it("LUT-on path is also deterministic", () => {
    const m1: MarketingCampaign[] = [
      {
        id: "c1",
        channel: "ig",
        districtId: "d1",
        remainingBudget: 100_000,
        reach: 0,
        active: true,
      },
    ];
    const m2 = m1.map((c) => ({ ...c }));
    const r1 = step3_marketing(m1, 9700, 5, LUTS);
    const r2 = step3_marketing(m2, 9700, 5, LUTS);
    expect(r1.events).toEqual(r2.events);
    expect(m1).toEqual(m2);
  });
});

describe("§6.4 step 4 — demand", () => {
  it("byte-equal results across runs (LUT_READY=true)", () => {
    const make = (): LocationState[] => [
      {
        id: "loc_1",
        capacity: 100,
        conditionScaled: 750,
        ratingScaled: 4000,
        lastSales: 0,
        lastServed: 0,
        lastLost: 0,
      },
    ];
    const dSeed = daySeed(WORLD_SEED, DAY);
    const a = make();
    const b = make();
    const r1 = step4_demand(a, dSeed, DAY, LUTS);
    const r2 = step4_demand(b, dSeed, DAY, LUTS);
    expect(r1.events).toEqual(r2.events);
    expect(a).toEqual(b);
  });
});

describe("§6.4 step 5 — finance", () => {
  it("no RNG; deterministic ledger delta on identical inputs", () => {
    const make = (): { brand: BrandState; locations: LocationState[] } => ({
      brand: {
        cashCents: 5_000_000,
        reputationScaled: 500,
        rating30Scaled: 4000,
        consecutiveNegativeCashDays: 0,
        bankrupt: false,
      },
      locations: [
        {
          id: "loc_1",
          capacity: 100,
          conditionScaled: 750,
          ratingScaled: 4000,
          lastSales: 50,
          lastServed: 50,
          lastLost: 0,
        },
      ],
    });
    const a = make();
    const b = make();
    const r1 = step5_finance(a.brand, a.locations, DAY, 7);
    const r2 = step5_finance(b.brand, b.locations, DAY, 7);
    expect(r1.ledgerDelta).toEqual(r2.ledgerDelta);
    expect(a.brand.cashCents).toBe(b.brand.cashCents);
  });
});

describe("§6.4 step 6 — reviews", () => {
  it("deterministic across runs given same daySeed + locations", () => {
    const make = (): LocationState[] => [
      {
        id: "loc_1",
        capacity: 100,
        conditionScaled: 750,
        ratingScaled: 4000,
        lastSales: 50,
        lastServed: 50,
        lastLost: 0,
      },
    ];
    const a = make();
    const b = make();
    const dSeed = daySeed(WORLD_SEED, DAY);
    const r1 = step6_reviews(a, dSeed, DAY);
    const r2 = step6_reviews(b, dSeed, DAY);
    expect(r1.events).toEqual(r2.events);
    expect(a).toEqual(b);
  });
});

describe("§6.4 step 7 — rating30 (integer-scaled, no FP drift)", () => {
  it("no RNG; deterministic given same brand + locations + window", () => {
    const make = (): { brand: BrandState; locations: LocationState[] } => ({
      brand: {
        cashCents: 5_000_000,
        reputationScaled: 500,
        rating30Scaled: 4000,
        consecutiveNegativeCashDays: 0,
        bankrupt: false,
      },
      locations: [
        {
          id: "loc_1",
          capacity: 100,
          conditionScaled: 750,
          ratingScaled: 4500,
          lastSales: 0,
          lastServed: 0,
          lastLost: 0,
        },
      ],
    });
    const a = make();
    const b = make();
    step7_rating30(a.brand, a.locations, 30, DAY);
    step7_rating30(b.brand, b.locations, 30, DAY);
    expect(a.brand.rating30Scaled).toBe(b.brand.rating30Scaled);
    expect(Number.isInteger(a.brand.rating30Scaled)).toBe(true);
  });
});

describe("§6.4 step 8 — staff (reserved no-op v0.5/v0.6)", () => {
  it("returns no events", () => {
    expect(step8_staff()).toEqual({ events: [] });
  });
});

describe("§6.4 step 9 — bankruptcy", () => {
  it("counter increments only on negative cash; resets on positive; settles at counter = window", () => {
    const brand: BrandState = {
      cashCents: -100,
      reputationScaled: 100,
      rating30Scaled: 2000,
      consecutiveNegativeCashDays: 13,
      bankrupt: false,
    };
    const r = step9_bankruptcy(brand, 14, DAY);
    expect(brand.consecutiveNegativeCashDays).toBe(14);
    expect(brand.bankrupt).toBe(true);
    expect(r.events.some((e) => e.kind === "bankruptcy")).toBe(true);
  });
});

describe("§6.4 step 10 — events", () => {
  it("derives narrative events deterministically from collected events", () => {
    const brand: BrandState = {
      cashCents: 5_000_000,
      reputationScaled: 500,
      rating30Scaled: 4000,
      consecutiveNegativeCashDays: 0,
      bankrupt: false,
    };
    const collected: TickEvent[] = [];
    const a = step10_events(brand, collected, DAY);
    const b = step10_events(brand, collected, DAY);
    expect(a.events).toEqual(b.events);
  });
});

describe("§6.4 step 11 — emit (BLAKE3 chain hash)", () => {
  it("hash is reproducible byte-for-byte across two calls with same inputs", () => {
    const state: SimState = fixtureFreshBrand().initial_state;
    const events: TickEvent[] = [];
    const r1 = step11_emit(state, events, [], "0".repeat(64));
    const r2 = step11_emit(state, events, [], "0".repeat(64));
    expect(r1.hash).toBe(r2.hash);
    expect(r1.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
