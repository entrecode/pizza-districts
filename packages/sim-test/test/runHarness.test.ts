// Drive `runDeterminismHarness` end-to-end against a fake engine. This is
// what proves the §4 artifact tree, the §5 intra-run determinism gate, and
// the §3.1 fixture-validation precondition before `@pd/sim` lands.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runDeterminismHarness } from "../src/runHarness";
import { canonicalJson } from "../src/canonical";
import type { EngineApi, FixtureFile, SimState, TickRecord } from "../src/types";

import freshFixture from "../src/fixtures/init-fresh-brand.json" with { type: "json" };
import leakFixture from "../src/fixtures/init-v0_5-attribute-leak.json" with { type: "json" };

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

function fakeEngine(): EngineApi {
  return {
    engineVersion: "fake-0.0.1",
    runTick(state, _inputs) {
      const next: SimState = { ...state, tick_index: ((state.tick_index as number) ?? 0) + 1 };
      return { state: next, events: [], hash: `h${next.tick_index}` };
    },
    replay(snapshot, ticks) {
      const records: TickRecord[] = [];
      let state = snapshot;
      for (let i = 0; i < ticks; i += 1) {
        const next: SimState = { ...state, tick_index: i };
        records.push({
          tick_index: i,
          hash: `h${i}`,
          events: [{ kind: "noop", tick: i }],
          state: next,
          engine_version: "fake-0.0.1",
        });
        state = next;
      }
      return records;
    },
  };
}

function fixtureFromJson(json: unknown): FixtureFile {
  const j = json as { brand_seed: string; initial_state: SimState };
  return { brand_seed: j.brand_seed, initial_state: j.initial_state };
}

describe("runDeterminismHarness — artifact tree", () => {
  it("writes the §4 artifact set with sha256 sidecars", () => {
    const out = tmpRun();
    const result = runDeterminismHarness({
      runId: "test-passive-1d",
      fixture: fixtureFromJson(freshFixture),
      ticks: 1,
      engine: fakeEngine(),
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
    const fixture = fixtureFromJson(freshFixture);
    const ra = runDeterminismHarness({
      runId: "a",
      fixture,
      ticks: 7,
      engine: fakeEngine(),
      outDir: a,
    });
    const rb = runDeterminismHarness({
      runId: "b",
      fixture,
      ticks: 7,
      engine: fakeEngine(),
      outDir: b,
    });
    expect(ra.tickChainSha256).toBe(rb.tickChainSha256);
    const ca = readFileSync(join(a, "tick-chain.ndjson"), "utf8");
    const cb = readFileSync(join(b, "tick-chain.ndjson"), "utf8");
    expect(ca).toBe(cb);
  });

  it("aborts before any tick when a v0.5 attribute leak is present", () => {
    const out = tmpRun();
    expect(() =>
      runDeterminismHarness({
        runId: "leak",
        fixture: fixtureFromJson(leakFixture),
        ticks: 7,
        engine: fakeEngine(),
        outDir: out,
      }),
    ).toThrow(/v0\.5 attribute leak/);
  });

  it("inputs.json is canonical and roundtrips with stable hash", () => {
    const out = tmpRun();
    runDeterminismHarness({
      runId: "stable",
      fixture: fixtureFromJson(freshFixture),
      ticks: 0,
      engine: fakeEngine(),
      outDir: out,
    });
    const inputs = readFileSync(join(out, "inputs.json"), "utf8");
    const parsed = JSON.parse(inputs);
    // Re-canonicalize and compare — must be byte-equal (no whitespace, sorted keys).
    expect(canonicalJson(parsed)).toBe(inputs);
  });
});
