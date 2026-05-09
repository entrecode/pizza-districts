// runDeterminismHarness — engine-backed §4 artifact-tree integration test.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { fixtureFreshBrand } from "../src/fixtures/engineFixtures";
import { runDeterminismHarness } from "../src/runHarness";
import { validateFixture } from "../src/validateFixture";

let tmpRoots: string[] = [];

afterEach(() => {
  for (const r of tmpRoots) rmSync(r, { recursive: true, force: true });
  tmpRoots = [];
});

function tmpRun(): string {
  const root = mkdtempSync(join(tmpdir(), "piz-harness-"));
  tmpRoots.push(root);
  return root;
}

describe("runDeterminismHarness — §4 artifact tree", () => {
  it("writes the full artifact set with sha256 sidecars", () => {
    const out = tmpRun();
    const result = runDeterminismHarness({
      runId: "passive-1d",
      fixture: fixtureFreshBrand(),
      ticks: 1,
      outDir: out,
    });
    expect(result.records).toHaveLength(1);
    for (const name of [
      "inputs.json",
      "tick-chain.ndjson",
      "finalState.json",
      "ledger.ndjson",
      "ratings.json",
      "events.ndjson",
      "meta.json",
    ]) {
      expect(() => readFileSync(join(out, name), "utf8")).not.toThrow();
    }
    for (const stem of ["inputs", "tick-chain", "finalState", "ledger", "ratings", "events"]) {
      expect(() => readFileSync(join(out, `${stem}.sha256`), "utf8")).not.toThrow();
    }
  });

  it("intra-run determinism: two runs produce identical tick-chain bytes", () => {
    const a = tmpRun();
    const b = tmpRun();
    const ra = runDeterminismHarness({
      runId: "a",
      fixture: fixtureFreshBrand(),
      ticks: 7,
      outDir: a,
    });
    const rb = runDeterminismHarness({
      runId: "b",
      fixture: fixtureFreshBrand(),
      ticks: 7,
      outDir: b,
    });
    expect(ra.tickChainSha256).toBe(rb.tickChainSha256);
    expect(readFileSync(join(a, "tick-chain.ndjson"), "utf8")).toBe(
      readFileSync(join(b, "tick-chain.ndjson"), "utf8"),
    );
  });

  it("aborts before any tick when a v0.5 attribute leak is present", () => {
    const legacy = {
      parcels: [{ id: "p_legacy", location_snapshot: { attributes: { resident_density: 50 } } }],
    };
    expect(() => validateFixture(legacy)).toThrow(/v0\.5 attribute leak/);
  });
});
