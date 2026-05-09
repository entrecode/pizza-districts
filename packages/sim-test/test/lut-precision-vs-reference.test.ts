// §6.5 LUT precision-vs-`Math.exp` reference (engine-blocked).
//
// This test asserts that the engine-side LUTs (`exp_clamped_q12` /
// `LUT_PRICE_PULL` and `one_minus_exp_neg_q16` / `LUT_MARKETING_REACH`)
// match the exact `Math.exp` reference at 64 sampled points to within ±1
// Q-unit. It runs once those LUTs land under PIZ-24.
//
// Until then, the test scaffolds the sample grid and the precision check
// so the engine PR only has to drop in the LUT import + uncomment.

import { describe, it } from "vitest";

const LUT_READY = process.env.LUT_READY === "1";

describe.skipIf(!LUT_READY)("§6.5 — LUT_PRICE_PULL / exp_clamped_q12 vs Math.exp", () => {
  it("matches Math.exp(-2 * x) clamped to [0.1, 2.0] within ±1 Q-unit at 64 sampled points", () => {
    // const { LUT_PRICE_PULL } = await import("@pd/sim/lut/exp_clamped_q12");
    // for (let i = 0; i < 64; i += 1) { ... assert ... }
    throw new Error("LUT_READY=1 reached but LUT import has not landed yet (PIZ-24)");
  });
});

describe.skipIf(!LUT_READY)(
  "§6.5 — LUT_MARKETING_REACH / one_minus_exp_neg_q16 vs Math.exp",
  () => {
    it("matches 1 - Math.exp(-x) within ±1 Q-unit at 64 sampled points; out-of-range clamps to 65535", () => {
      // const { LUT_MARKETING_REACH } = await import("@pd/sim/lut/one_minus_exp_neg_q16");
      // for (let i = 0; i < 64; i += 1) { ... assert ... }
      throw new Error("LUT_READY=1 reached but LUT import has not landed yet (PIZ-24)");
    });
  },
);

if (!LUT_READY) {
  describe("§6.5 — LUT precision tests (engine-blocked)", () => {
    it.skip("runs once PIZ-24 ships the LUTs (set LUT_READY=1)", () => {});
  });
}
