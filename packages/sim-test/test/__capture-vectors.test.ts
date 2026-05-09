// One-shot capture script for tick-hash + LUT reference vectors. Run with:
//   pnpm --filter @pd/sim-test exec vitest run test/__capture-vectors.ts
// when CAPTURE_VECTORS=1 is set, OR delete the test file (it's an explicit
// generation step, not a regression gate).

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it } from "vitest";

import {
  EXP_CLAMPED_Q12,
  EXP_CLAMPED_Q12_LEN,
  EXP_CLAMPED_Q12_X_MAX_Q10,
  EXP_CLAMPED_Q12_X_MIN_Q10,
  EXP_CLAMPED_Q12_Y_MAX,
  EXP_CLAMPED_Q12_Y_MIN,
  LUTS,
  ONE_MINUS_EXP_NEG_Q16,
  ONE_MINUS_EXP_NEG_Q16_LEN,
  ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8,
  ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8,
  ONE_MINUS_EXP_NEG_Q16_Y_MAX,
  ZERO_HASH,
  replay,
} from "@pd/sim";

import {
  fixtureFreshBrand,
  fixtureNearBankrupt,
  fixtureThreeLocations,
} from "../src/fixtures/engineFixtures";

const REFROOT = join(__dirname, "..", "reference-vectors");
const CAPTURE = process.env.CAPTURE_VECTORS === "1";

describe.skipIf(!CAPTURE)("CAPTURE_VECTORS=1 — write reference vectors", () => {
  it("write tick-hash.json", () => {
    const cases = [
      { fixture_id: "init-fresh-brand", factory: fixtureFreshBrand, ticks: 7 },
      { fixture_id: "init-fresh-brand", factory: fixtureFreshBrand, ticks: 28 },
      { fixture_id: "init-near-bankrupt", factory: fixtureNearBankrupt, ticks: 28 },
      { fixture_id: "init-three-locations", factory: fixtureThreeLocations, ticks: 7 },
    ];
    const vectors = cases.map(({ fixture_id, factory, ticks }) => {
      const records = replay(
        { startTick: 0, state: factory().initial_state, prevHash: ZERO_HASH, luts: LUTS },
        ticks,
      );
      return {
        fixture_id,
        brand_seed_hex: factory().brand_seed_hex,
        ticks,
        prev_hash: ZERO_HASH,
        lut_ready: true,
        tick_hashes: records.map((r) => r.tickHash),
      };
    });
    writeFileSync(
      join(REFROOT, "tick-hash.json"),
      JSON.stringify(
        {
          protocol:
            "engine: replay({startTick, state, prevHash, luts}, ticks).map(r => r.tickHash)",
          vectors,
        },
        null,
        2,
      ),
    );
  });

  it("write lut/exp_clamped_q12.json (full table + 64 sampled comparisons)", () => {
    const sampled: Array<{ x_q10: number; x: number; got_q12: number; ref_q12: number }> = [];
    const n = 64;
    for (let i = 0; i < n; i += 1) {
      const xQ10 =
        EXP_CLAMPED_Q12_X_MIN_Q10 +
        Math.floor(((EXP_CLAMPED_Q12_X_MAX_Q10 - EXP_CLAMPED_Q12_X_MIN_Q10) * i) / (n - 1));
      const x = xQ10 / 1024;
      const refQ12 = Math.max(
        EXP_CLAMPED_Q12_Y_MIN,
        Math.min(EXP_CLAMPED_Q12_Y_MAX, Math.round(Math.exp(x) * 4096)),
      );
      const idx = xQ10 - EXP_CLAMPED_Q12_X_MIN_Q10;
      sampled.push({ x_q10: xQ10, x, got_q12: EXP_CLAMPED_Q12[idx]!, ref_q12: refQ12 });
    }
    writeFileSync(
      join(REFROOT, "lut", "exp_clamped_q12.json"),
      JSON.stringify(
        {
          name: "exp_clamped_q12",
          formula_alias: "LUT_PRICE_PULL",
          input_q: 10,
          output_q: 12,
          x_min_q10: EXP_CLAMPED_Q12_X_MIN_Q10,
          x_max_q10: EXP_CLAMPED_Q12_X_MAX_Q10,
          y_min: EXP_CLAMPED_Q12_Y_MIN,
          y_max: EXP_CLAMPED_Q12_Y_MAX,
          length: EXP_CLAMPED_Q12_LEN,
          first_8: EXP_CLAMPED_Q12.slice(0, 8),
          last_8: EXP_CLAMPED_Q12.slice(-8),
          tolerance_q_units: 1,
          sampled_64: sampled,
        },
        null,
        2,
      ),
    );
  });

  it("write lut/one_minus_exp_neg_q16.json (full table + 64 sampled comparisons)", () => {
    const sampled: Array<{ x_q8: number; x: number; got_q16: number; ref_q16: number }> = [];
    const n = 64;
    for (let i = 0; i < n; i += 1) {
      const xQ8 = Math.floor((ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8 * i) / (n - 1));
      const x = xQ8 / 256;
      const refQ16 = Math.min(
        ONE_MINUS_EXP_NEG_Q16_Y_MAX,
        Math.max(0, Math.round((1 - Math.exp(-x)) * 65536)),
      );
      const idx = xQ8 - ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8;
      sampled.push({ x_q8: xQ8, x, got_q16: ONE_MINUS_EXP_NEG_Q16[idx]!, ref_q16: refQ16 });
    }
    writeFileSync(
      join(REFROOT, "lut", "one_minus_exp_neg_q16.json"),
      JSON.stringify(
        {
          name: "one_minus_exp_neg_q16",
          formula_alias: "LUT_MARKETING_REACH",
          input_q: 8,
          output_q: 16,
          x_min_q8: ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8,
          x_max_q8: ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8,
          y_min: ONE_MINUS_EXP_NEG_Q16[0],
          y_max: ONE_MINUS_EXP_NEG_Q16_Y_MAX,
          length: ONE_MINUS_EXP_NEG_Q16_LEN,
          first_8: ONE_MINUS_EXP_NEG_Q16.slice(0, 8),
          last_8: ONE_MINUS_EXP_NEG_Q16.slice(-8),
          tolerance_q_units: 1,
          sampled_64: sampled,
        },
        null,
        2,
      ),
    );
  });
});

describe.skipIf(CAPTURE)("__capture-vectors — sentinel", () => {
  it("(set CAPTURE_VECTORS=1 to regenerate reference vectors)", () => {});
});
