// Engine-shape types consumed by the harness.
//
// These mirror the public surface from
// [ADR-0003 §8](/PIZ/issues/PIZ-6#document-adr) so the harness can be
// scaffolded and unit-tested before `@pd/sim` exports `runTick` / `replay`.
// Once those exports land (CTO, see PIZ-31 dependencies §1), the engine
// types replace these via `import type { ... } from "@pd/sim"`.

import type { StreamRng } from "./streams";

export type SimState = Record<string, unknown>;
export type SimEvent = Record<string, unknown>;
export type TickInputs = Record<string, unknown>;

export interface TickRecord {
  tick_index: number;
  hash: string;
  events: SimEvent[];
  state: SimState;
  engine_version: string;
}

export interface RunTickResult {
  state: SimState;
  events: SimEvent[];
  hash: string;
}

export interface EngineApi {
  runTick(state: SimState, inputs: TickInputs, rng: StreamRng): RunTickResult;
  replay(snapshot: SimState, ticks: number, ctx: ReplayCtx): TickRecord[];
  engineVersion: string;
}

export interface ReplayCtx {
  worldSeed: bigint;
  brandSeed: bigint;
  inputsByTick: readonly TickInputs[];
  buildRng(seedRecipe: string): StreamRng;
}

export interface FixtureFile {
  brand_seed: string; // hex u64, e.g. "0xC0FFEE"
  world_seed?: string; // optional override; defaults to brand_seed
  initial_state: SimState;
  events?: readonly SimEvent[];
}

export interface HarnessRunArtifacts {
  runId: string;
  outDir: string;
}
