// §6.5 — LUT precision vs `Math.exp` reference at 64 sampled points;
// ±1 Q-unit per spec. Engine LUTs landed via PIZ-35.

import { describe, expect, it } from "vitest";

import {
  EXP_CLAMPED_Q12_LEN,
  EXP_CLAMPED_Q12_X_MIN_Q10,
  EXP_CLAMPED_Q12_X_MAX_Q10,
  EXP_CLAMPED_Q12_Y_MAX,
  EXP_CLAMPED_Q12_Y_MIN,
  ONE_MINUS_EXP_NEG_Q16_LEN,
  ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8,
  ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8,
  ONE_MINUS_EXP_NEG_Q16_Y_MAX,
  expClampedQ12,
  oneMinusExpNegQ16,
} from "@pd/sim";

describe("§6.5 — LUT_PRICE_PULL / exp_clamped_q12", () => {
  it("anchor table dimensions match the formula sheet contract", () => {
    expect(EXP_CLAMPED_Q12_LEN).toBe(3584);
    expect(EXP_CLAMPED_Q12_X_MIN_Q10).toBe(-2560); // -2.5 in Q10
    expect(EXP_CLAMPED_Q12_X_MAX_Q10).toBe(1023); // ~+1.0 in Q10
    expect(EXP_CLAMPED_Q12_Y_MIN).toBe(409); // 0.1 × 4096
    expect(EXP_CLAMPED_Q12_Y_MAX).toBe(8192); // 2.0 × 4096
  });

  it("64-point precision vs Math.exp within ±1 Q-unit, clamped to [409, 8192]", () => {
    const n = 64;
    for (let i = 0; i < n; i += 1) {
      // Sweep across the in-range domain.
      const xQ10 =
        EXP_CLAMPED_Q12_X_MIN_Q10 +
        Math.floor(((EXP_CLAMPED_Q12_X_MAX_Q10 - EXP_CLAMPED_Q12_X_MIN_Q10) * i) / (n - 1));
      const x = xQ10 / 1024; // back to real-domain
      const expectedReal = Math.exp(x);
      const expectedQ12 = Math.max(
        EXP_CLAMPED_Q12_Y_MIN,
        Math.min(EXP_CLAMPED_Q12_Y_MAX, Math.round(expectedReal * 4096)),
      );
      const got = expClampedQ12(xQ10);
      expect(Math.abs(got - expectedQ12)).toBeLessThanOrEqual(1);
    }
  });

  it("out-of-range below domain clamps to the min anchor", () => {
    expect(expClampedQ12(EXP_CLAMPED_Q12_X_MIN_Q10 - 1)).toBe(EXP_CLAMPED_Q12_Y_MIN);
    expect(expClampedQ12(-100_000)).toBe(EXP_CLAMPED_Q12_Y_MIN);
  });

  it("out-of-range above domain clamps to the max anchor (last entry)", () => {
    const lastEntry = expClampedQ12(EXP_CLAMPED_Q12_X_MAX_Q10);
    expect(expClampedQ12(EXP_CLAMPED_Q12_X_MAX_Q10 + 1)).toBe(lastEntry);
    expect(expClampedQ12(100_000)).toBe(lastEntry);
  });

  it("output is stable byte-for-byte across two calls", () => {
    for (let xQ10 = -2500; xQ10 <= 1000; xQ10 += 113) {
      expect(expClampedQ12(xQ10)).toBe(expClampedQ12(xQ10));
    }
  });
});

describe("§6.5 — LUT_MARKETING_REACH / one_minus_exp_neg_q16", () => {
  it("anchor table dimensions match the formula sheet contract", () => {
    expect(ONE_MINUS_EXP_NEG_Q16_LEN).toBe(2560);
    expect(ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8).toBe(0);
    expect(ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8).toBe(2559); // 9.996 in Q8 (last in-range entry)
    expect(ONE_MINUS_EXP_NEG_Q16_Y_MAX).toBe(65535);
  });

  it("64-point precision vs Math.exp within ±1 Q-unit, clamped to [0, 65535]", () => {
    const n = 64;
    for (let i = 0; i < n; i += 1) {
      const xQ8 = Math.floor((ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8 * i) / (n - 1));
      const x = xQ8 / 256;
      const expectedReal = 1 - Math.exp(-x);
      const expectedQ16 = Math.min(
        ONE_MINUS_EXP_NEG_Q16_Y_MAX,
        Math.max(0, Math.round(expectedReal * 65536)),
      );
      const got = oneMinusExpNegQ16(xQ8);
      expect(Math.abs(got - expectedQ16)).toBeLessThanOrEqual(1);
    }
  });

  it("out-of-range below domain returns the min anchor (≈0)", () => {
    expect(oneMinusExpNegQ16(-1)).toBe(oneMinusExpNegQ16(0));
  });

  it("out-of-range above domain saturates to 65535 (1.0 in Q16)", () => {
    expect(oneMinusExpNegQ16(ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8 + 1)).toBe(ONE_MINUS_EXP_NEG_Q16_Y_MAX);
    expect(oneMinusExpNegQ16(100_000)).toBe(ONE_MINUS_EXP_NEG_Q16_Y_MAX);
  });

  it("output is stable byte-for-byte across two calls", () => {
    for (let xQ8 = 0; xQ8 <= 2560; xQ8 += 91) {
      expect(oneMinusExpNegQ16(xQ8)).toBe(oneMinusExpNegQ16(xQ8));
    }
  });
});
