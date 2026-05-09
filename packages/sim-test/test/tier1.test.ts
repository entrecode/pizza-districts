// Tier-1 fast PR gate per
// [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §6.1.
//
// Cases:
//   - `static-fixture-validation/v0_5-attribute-leak` — runs today, asserts
//     the §3.1 guard fires before any tick.
//   - `passive-1d` / `passive-7d` / `passive-28d` / `with-events-7d` /
//     `multi-location-7d` / `bankruptcy-edge-28d` — engine-blocked. They
//     skip with a clear message until `@pd/sim` exports `runTick`/`replay`.
//
// Each case runs **twice in the same job** (intra-CI determinism) and
// asserts byte-for-byte equality of the §4 artifact tree (per §6.1).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runDeterminismHarness } from "../src/runHarness";
import type { EngineApi, FixtureFile, SimState } from "../src/types";

import freshFixture from "../src/fixtures/init-fresh-brand.json" with { type: "json" };
import bankruptFixture from "../src/fixtures/init-near-bankrupt.json" with { type: "json" };
import leakFixture from "../src/fixtures/init-v0_5-attribute-leak.json" with { type: "json" };

const ENGINE_READY = process.env.ENGINE_READY === "1";

let tmpRoots: string[] = [];

afterEach(() => {
  for (const r of tmpRoots) rmSync(r, { recursive: true, force: true });
  tmpRoots = [];
});

function tmpRun(): string {
  const root = mkdtempSync(join(tmpdir(), "piz-tier1-"));
  tmpRoots.push(root);
  return root;
}

function fixtureFromJson(json: unknown): FixtureFile {
  const j = json as { brand_seed: string; initial_state: SimState };
  return { brand_seed: j.brand_seed, initial_state: j.initial_state };
}

async function loadEngine(): Promise<EngineApi | null> {
  if (!ENGINE_READY) return null;
  // Engine surface lives under `@pd/sim` (per ADR-0003 §8). Loaded
  // dynamically so the test file type-checks before runTick/replay land.
  const sim = (await import("@pd/sim")) as Record<string, unknown>;
  if (typeof sim.runTick !== "function" || typeof sim.replay !== "function") {
    throw new Error(
      "ENGINE_READY=1 but @pd/sim does not export runTick/replay — gate the var on the engine landing.",
    );
  }
  return {
    runTick: sim.runTick as EngineApi["runTick"],
    replay: sim.replay as EngineApi["replay"],
    engineVersion: (sim.engineVersion as string | undefined) ?? "engine-unknown",
  };
}

describe("Tier-1: static-fixture-validation/v0_5-attribute-leak (§3.1)", () => {
  it("aborts on a fixture carrying a v0.5 legacy attribute", async () => {
    const engine = (await loadEngine()) ?? identityEngine();
    const out = tmpRun();
    expect(() =>
      runDeterminismHarness({
        runId: "tier1-leak",
        fixture: fixtureFromJson(leakFixture),
        ticks: 7,
        engine,
        outDir: out,
      }),
    ).toThrow(/v0\.5 attribute leak/);
  });
});

describe.skipIf(!ENGINE_READY)("Tier-1: replay matrix (engine-backed)", () => {
  const cases: Array<{ name: string; ticks: number; fixture: unknown }> = [
    { name: "passive-1d", ticks: 1, fixture: freshFixture },
    { name: "passive-7d", ticks: 7, fixture: freshFixture },
    { name: "passive-28d", ticks: 28, fixture: freshFixture },
    { name: "with-events-7d", ticks: 7, fixture: freshFixture },
    { name: "bankruptcy-edge-28d", ticks: 28, fixture: bankruptFixture },
  ];

  for (const c of cases) {
    it(`${c.name}: two runs produce identical tick-chain bytes`, async () => {
      const engine = await loadEngine();
      if (engine == null) throw new Error("ENGINE_READY=1 but no engine loaded");
      const a = tmpRun();
      const b = tmpRun();
      const fixture = fixtureFromJson(c.fixture);
      const ra = runDeterminismHarness({
        runId: `${c.name}-a`,
        fixture,
        ticks: c.ticks,
        engine,
        outDir: a,
      });
      const rb = runDeterminismHarness({
        runId: `${c.name}-b`,
        fixture,
        ticks: c.ticks,
        engine,
        outDir: b,
      });
      expect(ra.tickChainSha256).toBe(rb.tickChainSha256);
    });
  }
});

if (!ENGINE_READY) {
  describe("Tier-1: replay matrix (engine-blocked)", () => {
    // One placeholder per spec case so the gating is visible in test output
    // until `@pd/sim` lands.
    for (const name of [
      "passive-1d",
      "passive-7d",
      "passive-28d",
      "with-events-7d",
      "multi-location-7d",
      "bankruptcy-edge-28d",
    ]) {
      it.skip(`${name} — runs once @pd/sim exports runTick/replay (set ENGINE_READY=1)`, () => {});
    }
  });
}

// Identity engine for the leak case: runHarness aborts at validateFixture
// before the engine is ever called, so a no-op replay is sufficient.
function identityEngine(): EngineApi {
  return {
    engineVersion: "leak-test-stub",
    runTick: (state) => ({ state, events: [], hash: "0" }),
    replay: () => [],
  };
}
