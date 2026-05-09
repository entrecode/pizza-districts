// Harness-level types layered on top of `@pd/sim`.

import type { LookupTables, SimState, TickRecord } from "@pd/sim";

export type { SimState, TickRecord, LookupTables };

export interface FixtureFile {
  /** Stable identifier — appears in `inputs.json`. */
  id: string;
  /** Hex u64 brand seed (e.g. "0xC0FFEE"). Used for traceability + parity vs. the
   *  spec's brand_seed column; the actual SimState.brandSeed is in `state`. */
  brand_seed_hex: string;
  initial_state: SimState;
}

export interface HarnessRunArtifacts {
  runId: string;
  outDir: string;
}
