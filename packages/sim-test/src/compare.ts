// Tick-chain and JSON-pointer diff utilities for harness FAIL output.
//
// Per [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §5,
// when a determinism run fails, we surface:
//   1. The first divergent `tick_index` from `tick-chain.ndjson`.
//   2. A JSON-pointer-level diff of the pre/post tick state, events, and inputs
//      at that tick.
//
// `compareTickChains` does (1); `diffJsonPointers` does (2).

export interface TickChainRow {
  tick_index: number;
  hash: string;
  events_sha256: string;
  engine_version: string;
}

export interface ChainDivergence {
  tickIndex: number;
  field: keyof TickChainRow;
  expected: string | number;
  actual: string | number;
}

export type ChainComparison =
  | { kind: "match"; rows: number }
  | { kind: "length-mismatch"; expectedRows: number; actualRows: number }
  | { kind: "row-divergence"; divergence: ChainDivergence };

/**
 * Compare two `tick-chain.ndjson` payloads (one tick per line). Returns the
 * first row that differs, or `match` if both chains are byte-for-byte equal.
 */
export function compareTickChains(expected: string, actual: string): ChainComparison {
  const expRows = parseChain(expected);
  const actRows = parseChain(actual);
  if (expRows.length !== actRows.length) {
    return {
      kind: "length-mismatch",
      expectedRows: expRows.length,
      actualRows: actRows.length,
    };
  }
  for (let i = 0; i < expRows.length; i += 1) {
    const e = expRows[i]!;
    const a = actRows[i]!;
    const fields: (keyof TickChainRow)[] = [
      "tick_index",
      "hash",
      "events_sha256",
      "engine_version",
    ];
    for (const f of fields) {
      if (e[f] !== a[f]) {
        return {
          kind: "row-divergence",
          divergence: {
            tickIndex: e.tick_index,
            field: f,
            expected: e[f],
            actual: a[f],
          },
        };
      }
    }
  }
  return { kind: "match", rows: expRows.length };
}

function parseChain(ndjson: string): TickChainRow[] {
  const rows: TickChainRow[] = [];
  const lines = ndjson.split("\n");
  for (const line of lines) {
    if (line.length === 0) continue;
    const parsed = JSON.parse(line);
    rows.push({
      tick_index: parsed.tick_index,
      hash: parsed.hash,
      events_sha256: parsed.events_sha256,
      engine_version: parsed.engine_version,
    });
  }
  return rows;
}

export interface PointerDiff {
  pointer: string;
  expected: unknown;
  actual: unknown;
}

/**
 * Recursive JSON-pointer diff (RFC 6901). Walks both objects in parallel and
 * emits one entry per leaf-level mismatch or structural divergence.
 *
 * Limit `maxEntries` exists so a runaway state diff cannot blow up the FAIL
 * artifact past its 200 KB cap (§5).
 */
export function diffJsonPointers(
  expected: unknown,
  actual: unknown,
  maxEntries = 1000,
): PointerDiff[] {
  const out: PointerDiff[] = [];
  walk("", expected, actual, out, maxEntries);
  return out;
}

function walk(pointer: string, e: unknown, a: unknown, out: PointerDiff[], cap: number): void {
  if (out.length >= cap) return;
  if (deepEqual(e, a)) return;
  if (isPlainObject(e) && isPlainObject(a)) {
    const keys = new Set<string>([...Object.keys(e), ...Object.keys(a)]);
    const sorted = [...keys].sort();
    for (const k of sorted) {
      walk(pointer + "/" + escapePointer(k), e[k], a[k], out, cap);
      if (out.length >= cap) return;
    }
    return;
  }
  if (Array.isArray(e) && Array.isArray(a)) {
    const max = Math.max(e.length, a.length);
    for (let i = 0; i < max; i += 1) {
      walk(pointer + "/" + i, e[i], a[i], out, cap);
      if (out.length >= cap) return;
    }
    return;
  }
  out.push({ pointer: pointer === "" ? "/" : pointer, expected: e, actual: a });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

function escapePointer(token: string): string {
  // RFC 6901 §4: ~ → ~0, / → ~1
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}
