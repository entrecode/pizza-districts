// Tick-chain and JSON-pointer diff utilities — FAIL-output behavior.

import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/canonical";
import { compareTickChains, diffJsonPointers } from "../src/compare";

function chain(
  rows: Array<{ tick_index: number; hash: string; events_sha256: string; engine_version: string }>,
): string {
  return rows.map((r) => canonicalJson(r)).join("\n") + "\n";
}

describe("compareTickChains", () => {
  const baseline = chain([
    { tick_index: 0, hash: "h0", events_sha256: "e0", engine_version: "v0.6" },
    { tick_index: 1, hash: "h1", events_sha256: "e1", engine_version: "v0.6" },
    { tick_index: 2, hash: "h2", events_sha256: "e2", engine_version: "v0.6" },
  ]);

  it("reports match on identical chains", () => {
    expect(compareTickChains(baseline, baseline)).toEqual({ kind: "match", rows: 3 });
  });

  it("reports length-mismatch when row counts differ", () => {
    const shorter = chain([
      { tick_index: 0, hash: "h0", events_sha256: "e0", engine_version: "v0.6" },
    ]);
    expect(compareTickChains(baseline, shorter)).toEqual({
      kind: "length-mismatch",
      expectedRows: 3,
      actualRows: 1,
    });
  });

  it("pinpoints the first divergent row by field", () => {
    const drifted = chain([
      { tick_index: 0, hash: "h0", events_sha256: "e0", engine_version: "v0.6" },
      { tick_index: 1, hash: "DIFFERENT", events_sha256: "e1", engine_version: "v0.6" },
      { tick_index: 2, hash: "h2", events_sha256: "e2", engine_version: "v0.6" },
    ]);
    const result = compareTickChains(baseline, drifted);
    expect(result.kind).toBe("row-divergence");
    if (result.kind !== "row-divergence") return;
    expect(result.divergence.tickIndex).toBe(1);
    expect(result.divergence.field).toBe("hash");
    expect(result.divergence.expected).toBe("h1");
    expect(result.divergence.actual).toBe("DIFFERENT");
  });

  it("flags engine_version drift even when hash matches (cross-build)", () => {
    const cross = chain([
      { tick_index: 0, hash: "h0", events_sha256: "e0", engine_version: "v0.6" },
      { tick_index: 1, hash: "h1", events_sha256: "e1", engine_version: "v0.7" },
      { tick_index: 2, hash: "h2", events_sha256: "e2", engine_version: "v0.6" },
    ]);
    const result = compareTickChains(baseline, cross);
    expect(result.kind).toBe("row-divergence");
    if (result.kind !== "row-divergence") return;
    expect(result.divergence.field).toBe("engine_version");
    expect(result.divergence.tickIndex).toBe(1);
  });
});

describe("diffJsonPointers", () => {
  it("emits empty diff for identical objects", () => {
    expect(diffJsonPointers({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it("reports leaf divergence with RFC 6901 pointer", () => {
    const diff = diffJsonPointers({ a: { b: 1 } }, { a: { b: 2 } });
    expect(diff).toEqual([{ pointer: "/a/b", expected: 1, actual: 2 }]);
  });

  it("escapes ~ and / per RFC 6901 §4", () => {
    const diff = diffJsonPointers({ "a/b": 1 }, { "a/b": 2 });
    expect(diff[0]!.pointer).toBe("/a~1b");
    const diff2 = diffJsonPointers({ "a~b": 1 }, { "a~b": 2 });
    expect(diff2[0]!.pointer).toBe("/a~0b");
  });

  it("reports array index divergence", () => {
    const diff = diffJsonPointers([1, 2, 3], [1, 9, 3]);
    expect(diff).toEqual([{ pointer: "/1", expected: 2, actual: 9 }]);
  });

  it("reports both adds and removes when one side has extra keys", () => {
    const diff = diffJsonPointers({ a: 1 }, { a: 1, b: 2 });
    expect(diff).toEqual([{ pointer: "/b", expected: undefined, actual: 2 }]);
  });

  it("respects maxEntries cap", () => {
    const a = Array.from({ length: 50 }, (_, i) => i);
    const b = Array.from({ length: 50 }, (_, i) => i + 1000);
    const diff = diffJsonPointers(a, b, 5);
    expect(diff.length).toBe(5);
  });
});
