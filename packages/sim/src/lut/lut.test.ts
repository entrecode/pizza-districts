// Unit tests for `@pd/sim/lut`. Reference vectors per determinism-harness
// §6.4 (per-step boundaries) and §6.5 (precision-vs-Math.exp).

import { describe, expect, it } from "vitest";
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
  ONE_MINUS_EXP_NEG_Q16_Y_MIN,
  expClampedQ12,
  oneMinusExpNegQ16,
} from "./index";

describe("exp_clamped_q12 — array shape", () => {
  it("has 3584 entries (= 3.5 * 1024 = (1.0 - (-2.5)) * 1024)", () => {
    expect(EXP_CLAMPED_Q12_LEN).toBe(3584);
    expect(EXP_CLAMPED_Q12.length).toBe(3584);
  });

  it("input domain is Q10 [-2560, 1023] (== [-2.5, +1.0) at scale 1024)", () => {
    expect(EXP_CLAMPED_Q12_X_MIN_Q10).toBe(-2560);
    expect(EXP_CLAMPED_Q12_X_MAX_Q10).toBe(1023);
  });

  it("output range is Q12 [409, 8192] (== [0.1, 2.0] * 4096)", () => {
    expect(EXP_CLAMPED_Q12_Y_MIN).toBe(409);
    expect(EXP_CLAMPED_Q12_Y_MAX).toBe(8192);
  });

  it("every entry is within the declared output range", () => {
    for (let i = 0; i < EXP_CLAMPED_Q12_LEN; i += 1) {
      const v = EXP_CLAMPED_Q12[i]!;
      expect(v).toBeGreaterThanOrEqual(EXP_CLAMPED_Q12_Y_MIN);
      expect(v).toBeLessThanOrEqual(EXP_CLAMPED_Q12_Y_MAX);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("the array is frozen (cannot be mutated at runtime)", () => {
    expect(Object.isFrozen(EXP_CLAMPED_Q12)).toBe(true);
  });
});

describe("expClampedQ12 — boundary + reference vectors (§6.4)", () => {
  it("at xQ10 = -2560 (x = -2.5): clamped low (raw 0.0821 * 4096 ≈ 336 < 409)", () => {
    expect(expClampedQ12(-2560)).toBe(409);
  });

  it("at xQ10 = 0 (x = 0): exp(0) = 1.0 → exactly 4096", () => {
    expect(expClampedQ12(0)).toBe(4096);
  });

  it("at xQ10 = 1023 (x = +0.999023…): clamped high (raw ≈ 11128 > 8192)", () => {
    expect(expClampedQ12(1023)).toBe(8192);
  });

  it("at xQ10 = +512 (x = +0.5): exp(0.5) ≈ 1.6487 → 6753 (= round(1.6487 * 4096))", () => {
    // round(Math.exp(0.5) * 4096) = round(6753.13) = 6753 — but we ALSO need
    // to know whether this falls under the high-side clamp. 6753 < 8192 ✓.
    expect(expClampedQ12(512)).toBe(Math.round(Math.exp(0.5) * 4096));
  });

  it("at xQ10 = -1024 (x = -1): exp(-1) ≈ 0.3679 → 1507 (= round(0.3679 * 4096))", () => {
    // Math.exp(-1) ≈ 0.367879, * 4096 ≈ 1507.06 → 1507. > 409 ✓.
    expect(expClampedQ12(-1024)).toBe(Math.round(Math.exp(-1) * 4096));
  });

  it("out-of-range below (xQ10 = -10000): clamps to first entry", () => {
    expect(expClampedQ12(-10000)).toBe(EXP_CLAMPED_Q12[0]);
  });

  it("out-of-range above (xQ10 = +10000): clamps to last entry", () => {
    expect(expClampedQ12(10000)).toBe(EXP_CLAMPED_Q12[EXP_CLAMPED_Q12_LEN - 1]);
  });
});

describe("one_minus_exp_neg_q16 — array shape", () => {
  it("has 2560 entries (= 10 * 256)", () => {
    expect(ONE_MINUS_EXP_NEG_Q16_LEN).toBe(2560);
    expect(ONE_MINUS_EXP_NEG_Q16.length).toBe(2560);
  });

  it("input domain is Q8 [0, 2559] (== [0, 10) at scale 256)", () => {
    expect(ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8).toBe(0);
    expect(ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8).toBe(2559);
  });

  it("output range is Q16 [0, 65535]", () => {
    expect(ONE_MINUS_EXP_NEG_Q16_Y_MIN).toBe(0);
    expect(ONE_MINUS_EXP_NEG_Q16_Y_MAX).toBe(65535);
  });

  it("every entry is within the declared output range", () => {
    for (let i = 0; i < ONE_MINUS_EXP_NEG_Q16_LEN; i += 1) {
      const v = ONE_MINUS_EXP_NEG_Q16[i]!;
      expect(v).toBeGreaterThanOrEqual(ONE_MINUS_EXP_NEG_Q16_Y_MIN);
      expect(v).toBeLessThanOrEqual(ONE_MINUS_EXP_NEG_Q16_Y_MAX);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("monotonically non-decreasing across the domain", () => {
    for (let i = 1; i < ONE_MINUS_EXP_NEG_Q16_LEN; i += 1) {
      expect(ONE_MINUS_EXP_NEG_Q16[i]!).toBeGreaterThanOrEqual(ONE_MINUS_EXP_NEG_Q16[i - 1]!);
    }
  });

  it("the array is frozen", () => {
    expect(Object.isFrozen(ONE_MINUS_EXP_NEG_Q16)).toBe(true);
  });
});

describe("oneMinusExpNegQ16 — boundary + reference vectors (§6.4)", () => {
  it("at xQ8 = 0 (x = 0): 1 - exp(0) = 0", () => {
    expect(oneMinusExpNegQ16(0)).toBe(0);
  });

  it("at xQ8 = 256 (x = 1): 1 - exp(-1) ≈ 0.6321 → ≈ 41423 in Q16", () => {
    expect(oneMinusExpNegQ16(256)).toBe(Math.round((1 - Math.exp(-1)) * 65536));
  });

  it("at xQ8 = 2559 (x ≈ 9.996): saturated near 1.0 (Y > 65530)", () => {
    expect(oneMinusExpNegQ16(2559)).toBeGreaterThanOrEqual(65530);
    expect(oneMinusExpNegQ16(2559)).toBeLessThanOrEqual(65535);
  });

  it("at xQ8 = 1280 (x = 5): 1 - exp(-5) ≈ 0.9933 → ≈ 65094 in Q16", () => {
    expect(oneMinusExpNegQ16(1280)).toBe(Math.round((1 - Math.exp(-5)) * 65536));
  });

  it("out-of-range above (xQ8 > 2559): saturates to Y_MAX (65535)", () => {
    expect(oneMinusExpNegQ16(5000)).toBe(65535);
    expect(oneMinusExpNegQ16(100000)).toBe(65535);
  });

  it("out-of-range below (xQ8 < 0): clamps to first entry (= 0)", () => {
    expect(oneMinusExpNegQ16(-1)).toBe(0);
    expect(oneMinusExpNegQ16(-10000)).toBe(0);
  });
});

describe("§6.5 LUT precision vs Math.exp — exp_clamped_q12 (64 samples)", () => {
  // Sample 64 points across the unclamped sub-domain (where the LUT is not
  // saturated by the [409, 8192] cap). The unclamped sub-range is roughly
  // x in [-3.6, +0.69] but the LUT domain is [-2.5, +1.0); intersection is
  // [-2.5, 0.693). We sample inside that and assert ±1 Q-unit vs exact exp.
  it("matches round(exp(x) * 4096) within ±1 Q-unit at 64 samples in the unclamped sub-range", () => {
    const xMin = -2.5;
    const xMax = 0.693; // ln(2) — exp(0.693) = 2.0, the high clamp.
    for (let i = 0; i < 64; i += 1) {
      const x = xMin + ((xMax - xMin) * i) / 63;
      const xQ10 = Math.round(x * 1024);
      // Reference: exact exp scaled to Q12, rounded.
      const reference = Math.round(Math.exp(xQ10 / 1024) * 4096);
      const refClamped = Math.min(8192, Math.max(409, reference));
      const lut = expClampedQ12(xQ10);
      // |LUT - clamped reference| ≤ 1 Q-unit. The LUT IS the rounded
      // reference, so this is 0 in practice; the ±1 tolerance is the
      // formula sheet's spec margin.
      expect(Math.abs(lut - refClamped)).toBeLessThanOrEqual(1);
    }
  });
});

describe("§6.5 LUT precision vs Math.exp — one_minus_exp_neg_q16 (64 samples)", () => {
  it("matches round((1 - exp(-x)) * 65536) within ±1 Q-unit at 64 samples", () => {
    const xMin = 0;
    const xMax = 9.996; // last in-range entry
    for (let i = 0; i < 64; i += 1) {
      const x = xMin + ((xMax - xMin) * i) / 63;
      const xQ8 = Math.round(x * 256);
      const reference = Math.round((1 - Math.exp(-(xQ8 / 256))) * 65536);
      const refClamped = Math.min(65535, Math.max(0, reference));
      const lut = oneMinusExpNegQ16(xQ8);
      expect(Math.abs(lut - refClamped)).toBeLessThanOrEqual(1);
    }
  });
});

describe("LUTS — engine-ready LookupTables", () => {
  it("has LUT_READY = true and the two arrays wired", () => {
    expect(LUTS.LUT_READY).toBe(true);
    expect(LUTS.priceQ12).toBe(EXP_CLAMPED_Q12);
    expect(LUTS.oneMinusExpNegQ16).toBe(ONE_MINUS_EXP_NEG_Q16);
  });

  it("is frozen (engine cannot mutate the table at runtime)", () => {
    expect(Object.isFrozen(LUTS)).toBe(true);
  });
});
