// Determinism harness driver.
//
// Loads a fixture, runs the v0.6 attribute-leak guard
// (`validateFixture`), invokes the engine `replay()` once for the requested
// tick count, and writes the artifact tree under
// `artifacts/sim-runs/<run-id>/` per
// [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §4.
//
// Engine wiring is injected via `EngineApi` so the harness can be unit-tested
// independently of `@pd/sim`'s `runTick` / `replay` exports landing
// (PIZ-31 dependencies §1, owned by CTO).

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { canonicalJson } from "./canonical";
import { streamRng, type StreamRng } from "./streams";
import { validateFixture } from "./validateFixture";
import type {
  EngineApi,
  FixtureFile,
  HarnessRunArtifacts,
  ReplayCtx,
  SimEvent,
  SimState,
  TickInputs,
  TickRecord,
} from "./types";

export interface HarnessOptions {
  runId: string;
  fixture: FixtureFile;
  ticks: number;
  inputsByTick?: readonly TickInputs[];
  engine: EngineApi;
  outDir?: string;
  /** Override the substream factory (used by property tests for substream isolation). */
  buildRng?: (seedRecipe: string) => StreamRng;
}

export interface HarnessResult {
  artifacts: HarnessRunArtifacts;
  records: TickRecord[];
  finalState: SimState;
  events: SimEvent[];
  tickChainSha256: string;
}

const ARTIFACT_ROOT = join(process.cwd(), "artifacts", "sim-runs");

/**
 * Drive one full determinism run end-to-end, writing every required artifact.
 * Returns enough metadata for callers (CI, property tests) to assert on.
 */
export function runDeterminismHarness(opts: HarnessOptions): HarnessResult {
  validateFixture(opts.fixture.initial_state);

  const outDir = opts.outDir ?? join(ARTIFACT_ROOT, opts.runId);
  mkdirSync(outDir, { recursive: true });

  const worldSeed = parseHexU64(opts.fixture.world_seed ?? opts.fixture.brand_seed);
  const brandSeed = parseHexU64(opts.fixture.brand_seed);
  const inputsByTick = opts.inputsByTick ?? [];
  const buildRng = opts.buildRng ?? streamRng;

  const ctx: ReplayCtx = { worldSeed, brandSeed, inputsByTick, buildRng };

  // 1. Capture canonical inputs.
  const inputsCanonical: Record<string, unknown> = {
    engine_version: opts.engine.engineVersion,
    world_seed: hexU64(worldSeed),
    brand_seed: hexU64(brandSeed),
    ticks: opts.ticks,
    initial_state: opts.fixture.initial_state,
    inputs_by_tick: inputsByTick,
  };
  const inputsJson = canonicalJson(inputsCanonical);
  writeWithDigest(outDir, "inputs.json", inputsJson);

  // 2. Run replay.
  const records = opts.engine.replay(opts.fixture.initial_state, opts.ticks, ctx);

  // 3. Tick-chain ndjson + rolling SHA-256.
  const tickChain =
    records
      .map((r) => {
        const eventsCanonical = canonicalJson(r.events);
        const events_sha256 = sha256Hex(eventsCanonical);
        return canonicalJson({
          tick_index: r.tick_index,
          hash: r.hash,
          events_sha256,
          engine_version: r.engine_version,
        });
      })
      .join("\n") + (records.length > 0 ? "\n" : "");
  writeWithDigest(outDir, "tick-chain.ndjson", tickChain);
  const tickChainSha256 = sha256Hex(tickChain);

  // 4. Final state.
  const finalState =
    records.length > 0 ? records[records.length - 1]!.state : opts.fixture.initial_state;
  writeWithDigest(outDir, "finalState.json", canonicalJson(finalState));

  // 5. Ledger / ratings / events streams (best-effort projections; each engine
  //    surface lands under PIZ-31's downstream tickets).
  const ledgerNdjson = projectionLines(records, (r) => (r.state as { ledger?: unknown[] }).ledger);
  writeWithDigest(outDir, "ledger.ndjson", ledgerNdjson);

  const ratings = projectRatings(records);
  writeWithDigest(outDir, "ratings.json", canonicalJson(ratings));

  const eventsNdjson =
    records.map((r) => canonicalJson(r.events)).join("\n") + (records.length > 0 ? "\n" : "");
  writeWithDigest(outDir, "events.ndjson", eventsNdjson);

  // 6. Diagnostic-only meta (excluded from determinism comparison).
  writeFileAtomic(
    join(outDir, "meta.json"),
    JSON.stringify(
      {
        run_id: opts.runId,
        wall_clock_iso: new Date().toISOString(),
        host_node: process.version,
        // engine_version intentionally NOT here — it lives on every tick row.
      },
      null,
      2,
    ),
  );

  return {
    artifacts: { runId: opts.runId, outDir },
    records,
    finalState,
    events: records.flatMap((r) => r.events),
    tickChainSha256,
  };
}

function projectionLines(
  records: readonly TickRecord[],
  pick: (r: TickRecord) => unknown[] | undefined,
): string {
  const lines: string[] = [];
  for (const r of records) {
    const rows = pick(r) ?? [];
    for (const row of rows) lines.push(canonicalJson(row));
  }
  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

function projectRatings(records: readonly TickRecord[]): Record<string, unknown> {
  if (records.length === 0) return { tick_index: -1, locations: [], brand: null };
  const last = records[records.length - 1]!;
  const state = last.state as {
    locations?: Array<{ id: string; rating_30_scaled?: number }>;
    brand_state?: { rating_30_scaled?: number };
  };
  return {
    tick_index: last.tick_index,
    locations: (state.locations ?? []).map((l) => ({
      id: l.id,
      rating_30_scaled: l.rating_30_scaled ?? null,
    })),
    brand: state.brand_state?.rating_30_scaled ?? null,
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

function parseHexU64(s: string): bigint {
  // Accepts "0xC0FFEE" or "C0FFEE"; returns u64 mask-truncated.
  const stripped = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
  if (!/^[0-9a-fA-F]+$/.test(stripped)) {
    throw new Error(`harness: invalid hex u64 seed "${s}"`);
  }
  return BigInt("0x" + stripped) & 0xffffffffffffffffn;
}

function hexU64(v: bigint): string {
  return "0x" + v.toString(16).toUpperCase().padStart(16, "0");
}
