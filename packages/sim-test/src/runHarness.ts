// Determinism harness driver — engine-backed.
//
// Calls `@pd/sim`'s `replay()` for the requested tick count and writes the
// §4 artifact tree under `artifacts/sim-runs/<run-id>/` per
// [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §4.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { LUTS, ZERO_HASH, canonicalJson, replay } from "@pd/sim";
import type { LookupTables, TickRecord } from "@pd/sim";

import { validateFixture } from "./validateFixture";
import type { FixtureFile, HarnessRunArtifacts } from "./types";

export interface HarnessOptions {
  runId: string;
  fixture: FixtureFile;
  ticks: number;
  startTick?: number;
  prevHash?: string;
  /** Override the LUT pack — defaults to engine's real LUTs. Tests may pass
   *  `EMPTY_LUTS` to force step3/step4 identity behavior. */
  luts?: LookupTables;
  outDir?: string;
}

export interface HarnessResult {
  artifacts: HarnessRunArtifacts;
  records: TickRecord[];
  tickChainSha256: string;
}

const ARTIFACT_ROOT = join(process.cwd(), "artifacts", "sim-runs");

/**
 * Drive one full determinism run end-to-end, writing every required artifact.
 * Returns enough metadata for callers (CI, property tests) to assert on.
 */
export function runDeterminismHarness(opts: HarnessOptions): HarnessResult {
  // §3.1 attribute-leak guard — runs unconditionally; no-op when state has
  // no `parcels` field (engine SimState v0.6 doesn't have parcels; the guard
  // only fires on legacy fixtures that DO carry the field).
  validateFixture(opts.fixture.initial_state as unknown);

  const outDir = opts.outDir ?? join(ARTIFACT_ROOT, opts.runId);
  mkdirSync(outDir, { recursive: true });

  const startTick = opts.startTick ?? 0;
  const prevHash = opts.prevHash ?? ZERO_HASH;
  const luts = opts.luts ?? LUTS;

  // 1. Capture canonical inputs.
  const inputsCanonical = {
    engineVersion: opts.fixture.initial_state.engineVersion,
    fixtureId: opts.fixture.id,
    brandSeedHex: opts.fixture.brand_seed_hex,
    startTick,
    ticks: opts.ticks,
    prevHash,
    lutReady: luts.LUT_READY,
    initialState: opts.fixture.initial_state as unknown,
  };
  const inputsJson = canonicalJson(inputsCanonical);
  writeWithDigest(outDir, "inputs.json", inputsJson);

  // 2. Run replay.
  const records = replay(
    {
      startTick,
      state: opts.fixture.initial_state,
      prevHash,
      luts,
    },
    opts.ticks,
  );

  // 3. Tick-chain ndjson + rolling SHA-256.
  const tickChain =
    records
      .map((r) => {
        const eventsCanonical = canonicalJson(r.events as unknown);
        const events_sha256 = sha256Hex(eventsCanonical);
        return canonicalJson({
          tick_index: r.tickIndex,
          hash: r.tickHash,
          events_sha256,
          engine_version: r.engineVersion,
        });
      })
      .join("\n") + (records.length > 0 ? "\n" : "");
  writeWithDigest(outDir, "tick-chain.ndjson", tickChain);
  const tickChainSha256 = sha256Hex(tickChain);

  // 4. Final state summary (tail of records). The engine doesn't emit full
  //    SimState in TickRecord — only `stateSummary` — so we record that.
  const finalSummary =
    records.length > 0
      ? records[records.length - 1]!.stateSummary
      : {
          cashCents: 0,
          rating30Scaled: 0,
          consecutiveNegativeCashDays: 0,
          bankrupt: false,
          weather: 0,
        };
  writeWithDigest(outDir, "finalState.json", canonicalJson(finalSummary as unknown));

  // 5. Ledger / events ndjson — concatenation of per-tick projections.
  const ledgerNdjson =
    records.flatMap((r) => r.ledger.map((l) => canonicalJson(l as unknown))).join("\n") +
    (records.some((r) => r.ledger.length > 0) ? "\n" : "");
  writeWithDigest(outDir, "ledger.ndjson", ledgerNdjson);

  const ratings = {
    tickIndex: records.length > 0 ? records[records.length - 1]!.tickIndex : -1,
    rating30Scaled:
      records.length > 0 ? records[records.length - 1]!.stateSummary.rating30Scaled : null,
  };
  writeWithDigest(outDir, "ratings.json", canonicalJson(ratings as unknown));

  const eventsNdjson =
    records.map((r) => canonicalJson(r.events as unknown)).join("\n") +
    (records.length > 0 ? "\n" : "");
  writeWithDigest(outDir, "events.ndjson", eventsNdjson);

  // 6. Diagnostic-only meta (excluded from determinism comparison).
  writeFileAtomic(
    join(outDir, "meta.json"),
    JSON.stringify(
      {
        run_id: opts.runId,
        wall_clock_iso: new Date().toISOString(),
        host_node: process.version,
      },
      null,
      2,
    ),
  );

  return {
    artifacts: { runId: opts.runId, outDir },
    records,
    tickChainSha256,
  };
}

function writeWithDigest(dir: string, name: string, body: string): void {
  writeFileAtomic(join(dir, name), body);
  writeFileAtomic(
    join(dir, `${name.replace(/\.[^.]+$/, "")}.sha256`),
    `${sha256Hex(body)}  ${name}\n`,
  );
}

function writeFileAtomic(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, { encoding: "utf8" });
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}
