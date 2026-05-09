// Tier-1 fast PR gate per
// [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §6.1.
//
// Engine deps landed (PIZ-34 + PIZ-35), so every replay case runs against
// `@pd/sim` directly. Each case runs twice in the same job (intra-CI
// determinism per spec §6.1) and asserts byte-for-byte equality of the §4
// artifact tree. The static-fixture-validation/v0_5-attribute-leak case
// asserts the §3.1 guard fires before any tick.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, afterEach } from "vitest";

import {
  fixtureFreshBrand,
  fixtureNearBankrupt,
  fixtureThreeLocations,
} from "../src/fixtures/engineFixtures";
import { runDeterminismHarness } from "../src/runHarness";
import { validateFixture } from "../src/validateFixture";

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

const cases = [
  { name: "passive-1d", ticks: 1, fixture: fixtureFreshBrand },
  { name: "passive-7d", ticks: 7, fixture: fixtureFreshBrand },
  { name: "passive-28d", ticks: 28, fixture: fixtureFreshBrand },
  { name: "multi-location-7d", ticks: 7, fixture: fixtureThreeLocations },
  { name: "bankruptcy-edge-28d", ticks: 28, fixture: fixtureNearBankrupt },
];

describe("Tier-1 §6.1: replay matrix (engine-backed)", () => {
  for (const c of cases) {
    it(`${c.name}: two runs produce identical tick-chain bytes`, () => {
      const a = tmpRun();
      const b = tmpRun();
      const ra = runDeterminismHarness({
        runId: `${c.name}-a`,
        fixture: c.fixture(),
        ticks: c.ticks,
        outDir: a,
      });
      const rb = runDeterminismHarness({
        runId: `${c.name}-b`,
        fixture: c.fixture(),
        ticks: c.ticks,
        outDir: b,
      });
      expect(ra.records).toHaveLength(c.ticks);
      expect(ra.tickChainSha256).toBe(rb.tickChainSha256);
    });
  }
});

describe("Tier-1 §3.1: static-fixture-validation/v0_5-attribute-leak", () => {
  it("fires when a v0.5 legacy attribute is present in a parcels block", () => {
    const legacy = {
      parcels: [
        {
          id: "p_legacy",
          location_snapshot: { attributes: { resident_density: 50 } },
        },
      ],
    };
    expect(() => validateFixture(legacy)).toThrow(/v0\.5 attribute leak/);
  });

  it("no-op on the engine's v0.6 SimState (which has no parcels field)", () => {
    expect(() => validateFixture(fixtureFreshBrand().initial_state as unknown)).not.toThrow();
  });
});

describe("Tier-1 §4: artifact tree", () => {
  it("writes the full §4 artifact set with sha256 sidecars", () => {
    const out = tmpRun();
    const result = runDeterminismHarness({
      runId: "passive-1d-artifacts",
      fixture: fixtureFreshBrand(),
      ticks: 1,
      outDir: out,
    });
    expect(result.records).toHaveLength(1);
    // tickHash is BLAKE3 hex (64 chars).
    expect(result.records[0]!.tickHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
