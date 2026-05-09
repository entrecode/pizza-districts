// Tier-2 long replay (nightly + release-tag-PR gate) per
// [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §6.2.
//
// Gating per spec:
//   - All cases require `process.env.TIER === "2"`.
//   - LUT-dependent cases additionally require `process.env.LUT_READY === "1"`.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { EMPTY_LUTS, LUTS } from "@pd/sim";

import {
  fixtureFreshBrand,
  fixtureNearBankrupt,
  fixtureThreeLocations,
} from "../src/fixtures/engineFixtures";
import { runDeterminismHarness } from "../src/runHarness";

const TIER_2 = process.env.TIER === "2";
const LUT_READY = process.env.LUT_READY === "1";

let tmpRoots: string[] = [];

afterEach(() => {
  for (const r of tmpRoots) rmSync(r, { recursive: true, force: true });
  tmpRoots = [];
});

function tmpRun(): string {
  const root = mkdtempSync(join(tmpdir(), "piz-tier2-"));
  tmpRoots.push(root);
  return root;
}

interface Tier2Case {
  name: string;
  ticks: number;
  fixture: () => ReturnType<typeof fixtureFreshBrand>;
  lutDependent: boolean;
}

const cases: Tier2Case[] = [
  { name: "replay-fresh-365", ticks: 365, fixture: fixtureFreshBrand, lutDependent: false },
  { name: "replay-three-loc-365", ticks: 365, fixture: fixtureThreeLocations, lutDependent: false },
  { name: "replay-bankruptcy-365", ticks: 365, fixture: fixtureNearBankrupt, lutDependent: false },
  // LUT-dependent cases share fixtures with their Tier-1 counterparts in this
  // refit; once the formula-sheet-driven fixtures land they replace these.
  {
    name: "replay-marketing-heavy-365",
    ticks: 365,
    fixture: fixtureFreshBrand,
    lutDependent: true,
  },
  {
    name: "replay-price-sweep-180",
    ticks: 180,
    fixture: fixtureThreeLocations,
    lutDependent: true,
  },
];

describe("Tier-2 long replay matrix", () => {
  for (const c of cases) {
    const blocked: string[] = [];
    if (!TIER_2) blocked.push("TIER=2 not set");
    if (c.lutDependent && !LUT_READY) blocked.push("LUT_READY=1 not set");
    if (blocked.length > 0) {
      it.skip(`${c.name} — blocked: ${blocked.join("; ")}`, () => {});
      continue;
    }
    it(`${c.name}: ${c.ticks} ticks, intra-run determinism`, () => {
      const a = tmpRun();
      const b = tmpRun();
      const luts = c.lutDependent ? LUTS : EMPTY_LUTS;
      const ra = runDeterminismHarness({
        runId: `${c.name}-a`,
        fixture: c.fixture(),
        ticks: c.ticks,
        luts,
        outDir: a,
      });
      const rb = runDeterminismHarness({
        runId: `${c.name}-b`,
        fixture: c.fixture(),
        ticks: c.ticks,
        luts,
        outDir: b,
      });
      expect(ra.tickChainSha256).toBe(rb.tickChainSha256);
      expect(ra.records).toHaveLength(c.ticks);
    }, 30_000);
  }
});
