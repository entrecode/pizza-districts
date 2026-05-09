// Pure-integer LUT helpers for `@pd/sim`. Replace the only two transcendentals
// in v0.5/v0.6/v0.7 (`exp` for `price_pull`, `1 - exp(-x)` for marketing
// growth) so the runtime never imports `Math.exp` (ADR-0003 §4.1, banned
// build-time list).
//
// The arrays themselves are auto-generated; this file owns the indexing,
// clamping, and the typed `LUT_READY` constants the engine depends on.

import type { LookupTables } from "../types";
import {
  EXP_CLAMPED_Q12,
  EXP_CLAMPED_Q12_LEN,
  EXP_CLAMPED_Q12_X_MIN_Q10,
  EXP_CLAMPED_Q12_X_MAX_Q10,
  EXP_CLAMPED_Q12_Y_MAX,
  EXP_CLAMPED_Q12_Y_MIN,
} from "./exp_clamped_q12";
import {
  ONE_MINUS_EXP_NEG_Q16,
  ONE_MINUS_EXP_NEG_Q16_LEN,
  ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8,
  ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8,
  ONE_MINUS_EXP_NEG_Q16_Y_MAX,
  ONE_MINUS_EXP_NEG_Q16_Y_MIN,
} from "./one_minus_exp_neg_q16";

export {
  EXP_CLAMPED_Q12,
  EXP_CLAMPED_Q12_LEN,
  EXP_CLAMPED_Q12_X_MIN_Q10,
  EXP_CLAMPED_Q12_X_MAX_Q10,
  EXP_CLAMPED_Q12_Y_MAX,
  EXP_CLAMPED_Q12_Y_MIN,
  ONE_MINUS_EXP_NEG_Q16,
  ONE_MINUS_EXP_NEG_Q16_LEN,
  ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8,
  ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8,
  ONE_MINUS_EXP_NEG_Q16_Y_MAX,
  ONE_MINUS_EXP_NEG_Q16_Y_MIN,
};

/**
 * `exp(x) * 4096`, clamped to `[409, 8192]` (= `[0.1, 2.0] * 4096`).
 *
 * @param xQ10 input in Q10 (= integer × 2^-10). Floored to integer if it
 *             arrives non-integer (caller bug, but we don't throw — keeping
 *             the hot path branch-light).
 * @returns Q12 unsigned integer in `[409, 8192]`.
 */
export function expClampedQ12(xQ10: number): number {
  const x = xQ10 | 0;
  if (x <= EXP_CLAMPED_Q12_X_MIN_Q10) return EXP_CLAMPED_Q12[0]!;
  if (x >= EXP_CLAMPED_Q12_X_MAX_Q10) return EXP_CLAMPED_Q12[EXP_CLAMPED_Q12_LEN - 1]!;
  const idx = x - EXP_CLAMPED_Q12_X_MIN_Q10;
  return EXP_CLAMPED_Q12[idx]!;
}

/**
 * `(1 - exp(-x)) * 65536`, clamped to `[0, 65535]`.
 *
 * `xQ8 < 0` returns `0`. `xQ8 > X_MAX_Q8` (i.e. x > 10) saturates to `65535`
 * (= 1.0 in Q16). At the last in-range entry (xQ8 == X_MAX_Q8), returns the
 * array value (≈ 65532), not the saturation cap — saturation kicks in only
 * beyond the domain.
 *
 * @param xQ8 input in Q8 (= integer × 2^-8). Floored to integer.
 * @returns Q16 unsigned integer in `[0, 65535]`.
 */
export function oneMinusExpNegQ16(xQ8: number): number {
  const x = xQ8 | 0;
  if (x < ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8) return ONE_MINUS_EXP_NEG_Q16[0]!;
  if (x > ONE_MINUS_EXP_NEG_Q16_X_MAX_Q8) return ONE_MINUS_EXP_NEG_Q16_Y_MAX;
  const idx = x - ONE_MINUS_EXP_NEG_Q16_X_MIN_Q8;
  return ONE_MINUS_EXP_NEG_Q16[idx]!;
}

/**
 * Engine-ready `LookupTables` value. Once these LUTs land in the runtime,
 * `step3_marketing` and `step4_demand` can replace `EMPTY_LUTS` with `LUTS`
 * and gate behavior on `LUT_READY=true`.
 */
export const LUTS: LookupTables = Object.freeze({
  LUT_READY: true,
  priceQ12: EXP_CLAMPED_Q12,
  oneMinusExpNegQ16: ONE_MINUS_EXP_NEG_Q16,
});
