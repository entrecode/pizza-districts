#!/usr/bin/env node
// Regenerate `reference-vectors/canonical.json`. Mirrors the algorithm in
// `src/canonical.ts`. Commit-then-spec-update is the authorized flow.

const inputs = [
  { name: "empty-object", input: {} },
  { name: "empty-array", input: [] },
  { name: "primitive-null", input: null },
  { name: "primitive-true", input: true },
  { name: "primitive-false", input: false },
  { name: "primitive-zero", input: 0 },
  { name: "primitive-negzero", input: -0 },
  { name: "string-with-escapes", input: 'a"\nb\t' },
  { name: "key-sort-utf16", input: { z: 1, a: 2, m: 3, A: 4 } },
  { name: "nested-key-sort", input: { outer: { c: 1, a: 2, b: 3 }, alpha: [3, 1, 2] } },
  { name: "money-cents-integer", input: { cash_cents: 5000000, rent_cents: -120000 } },
  {
    name: "rating-30-scaled",
    input: { rating_30_scaled: 4123, consecutive_negative_cash_days: 0 },
  },
  {
    name: "tick-record-shape",
    input: {
      tick_index: 7,
      hash: "blake3:abc",
      events: [{ kind: "rent_paid", amount_cents: -120000 }],
      engine_version: "v0.6",
    },
  },
  { name: "object-with-undefined-key-dropped", input: { a: 1, b: undefined, c: 3 } },
];

function encode(v) {
  if (v === null) return "null";
  if (v === undefined) throw new Error("undefined");
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("non-finite");
    if (Object.is(v, -0)) return "0";
    return String(v);
  }
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(encode).join(",") + "]";
  if (typeof v === "object") {
    const ks = Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort();
    return "{" + ks.map((k) => JSON.stringify(k) + ":" + encode(v[k])).join(",") + "}";
  }
  throw new Error("unsupported type: " + typeof v);
}

const vectors = inputs.map(({ name, input }) => ({ name, input, output: encode(input) }));

console.log(
  JSON.stringify(
    {
      spec: "RFC 8785 / JCS subset (engine ↔ harness contract)",
      notes:
        "ECMA-262 Number.toString shortest round-trip; -0 collapsed to 0; non-finite numbers and undefined throw; UTF-16 code-unit key order; JSON.stringify string escapes",
      vectors,
    },
    null,
    2,
  ),
);
