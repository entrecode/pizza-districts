// Reference-vector test for `tick_hash` chains. Each fixture's first N
// `tickHash` values are committed under `reference-vectors/tick-hash.json`;
// the engine's `replay()` MUST produce the same chain on every run and
// every machine. This test asserts that contract.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LUTS, ZERO_HASH, replay } from "@pd/sim";

import {
  fixtureFreshBrand,
  fixtureNearBankrupt,
  fixtureThreeLocations,
} from "../src/fixtures/engineFixtures";

interface TickHashVector {
  fixture_id: string;
  brand_seed_hex: string;
  ticks: number;
  prev_hash: string;
  lut_ready: boolean;
  tick_hashes: string[];
}

interface VectorFile {
  protocol: string;
  vectors: TickHashVector[];
}

const VECTORS = JSON.parse(
  readFileSync(join(__dirname, "..", "reference-vectors", "tick-hash.json"), "utf8"),
) as VectorFile;

const fixtures: Record<string, () => ReturnType<typeof fixtureFreshBrand>> = {
  "init-fresh-brand": fixtureFreshBrand,
  "init-near-bankrupt": fixtureNearBankrupt,
  "init-three-locations": fixtureThreeLocations,
};

describe("tick_hash reference vectors", () => {
  for (const v of VECTORS.vectors) {
    it(`${v.fixture_id} × ${v.ticks} ticks — chain matches committed vector`, () => {
      const factory = fixtures[v.fixture_id];
      if (!factory) throw new Error(`unknown fixture: ${v.fixture_id}`);
      const records = replay(
        {
          startTick: 0,
          state: factory().initial_state,
          prevHash: v.prev_hash,
          luts: v.lut_ready ? LUTS : undefined,
        },
        v.ticks,
      );
      expect(records.map((r) => r.tickHash)).toEqual(v.tick_hashes);
    });
  }

  it("references chain off ZERO_HASH for fresh runs", () => {
    expect(ZERO_HASH).toBe("0".repeat(64));
  });
});
