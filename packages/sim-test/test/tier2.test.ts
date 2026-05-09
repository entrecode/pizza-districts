// Tier-2 long replay (nightly + release-tag-PR gate) per
// [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §6.2.
//
// Gating rules (per spec):
//   - All cases require `process.env.TIER === "2"`.
//   - `replay-marketing-heavy-365` and `replay-price-sweep-180` additionally
//     require `process.env.LUT_READY === "1"` because they rely on the
//     marketing-uplift / price-pull LUTs from PIZ-24.
//   - All cases require `process.env.ENGINE_READY === "1"` (i.e. `@pd/sim`
//     exports `runTick`/`replay`).
//
// When the env gate is open this file becomes a real replay matrix; when
// it's closed (default), the cases skip with a single explanatory line so
// developers running `pnpm test` locally still see the gate status.

import { describe, it } from "vitest";

const TIER_2 = process.env.TIER === "2";
const ENGINE_READY = process.env.ENGINE_READY === "1";
const LUT_READY = process.env.LUT_READY === "1";

const cases: Array<{ name: string; ticks: number; lutDependent: boolean }> = [
  { name: "replay-fresh-365", ticks: 365, lutDependent: false },
  { name: "replay-three-loc-365", ticks: 365, lutDependent: false },
  { name: "replay-aggressive-ai-365", ticks: 365, lutDependent: false },
  { name: "replay-marketing-heavy-365", ticks: 365, lutDependent: true },
  { name: "replay-bankruptcy-365", ticks: 365, lutDependent: false },
  { name: "replay-price-sweep-180", ticks: 180, lutDependent: true },
  { name: "all-features-365", ticks: 365, lutDependent: false },
];

describe("Tier-2 long replay matrix", () => {
  for (const c of cases) {
    const blocked: string[] = [];
    if (!TIER_2) blocked.push("TIER=2 not set");
    if (!ENGINE_READY) blocked.push("ENGINE_READY=1 not set (waiting on @pd/sim runTick/replay)");
    if (c.lutDependent && !LUT_READY) {
      blocked.push("LUT_READY=1 not set (waiting on PIZ-24 LUTs)");
    }
    if (blocked.length > 0) {
      it.skip(`${c.name} — blocked: ${blocked.join("; ")}`, () => {});
      continue;
    }
    it(`${c.name}: ${c.ticks} ticks, intra-run + cross-build determinism`, () => {
      // Real replay lands once the engine + LUTs are wired (PIZ-31 deps §1, §3).
      // The harness scaffold (loadFixture → validateFixture → replay → write
      // artifacts → compareTickChains) is already in `runDeterminismHarness`;
      // add the engine import + baseline `tick-chain.ndjson` here at that point.
      throw new Error(
        `tier2 case ${c.name} reached the unblocked branch but the engine wiring patch has not landed; add it on top of runHarness.ts`,
      );
    });
  }
});
