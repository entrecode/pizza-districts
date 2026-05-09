// Top-level replay orchestrator. ADR-0003 §8.
// `replay(snapshot, ticks) → TickRecord[]`
//
// Walks `ticks` ticks forward from `snapshot.startTick`, threading `prevHash`
// across the chain. Used by the determinism harness for full replay.

import { ZERO_HASH } from "./hash";
import { runTick } from "./runTick";
import type { LookupTables, SimState, TickRecord } from "./types";
import { EMPTY_LUTS } from "./types";

export interface ReplaySnapshot {
  readonly startTick: number;
  readonly state: SimState;
  readonly prevHash?: string;
  readonly luts?: LookupTables;
}

export function replay(snapshot: ReplaySnapshot, ticks: number): TickRecord[] {
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new Error("replay: ticks must be a non-negative integer");
  }
  const luts = snapshot.luts ?? EMPTY_LUTS;
  const records: TickRecord[] = [];
  let state: SimState = snapshot.state;
  let prevHash = snapshot.prevHash ?? ZERO_HASH;
  for (let i = 0; i < ticks; i += 1) {
    const tickIndex = snapshot.startTick + i;
    const result = runTick(state, { tickIndex }, prevHash, luts);
    state = result.state;
    prevHash = result.hash;
    records.push(result.record);
  }
  return records;
}
