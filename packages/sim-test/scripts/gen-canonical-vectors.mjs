#!/usr/bin/env node
// Regenerate `reference-vectors/canonical.json` against `@pd/sim`'s
// canonical-JSON encoder. Inlines the engine's encoder body so the script
// has no runtime deps; `test/canonical.test.ts` asserts the engine's
// runtime output matches these vectors. BigInt + undefined cases live in
// the test file directly (they're not JSON-roundtrippable on disk).

const inputs = [
  { name: "empty-object", input: {} },
  { name: "empty-array", input: [] },
  { name: "primitive-null", input: null },
  { name: "primitive-true", input: true },
  { name: "primitive-false", input: false },
  { name: "primitive-zero", input: 0 },
  { name: "string-with-escapes", input: 'a"\nb\t' },
  { name: "key-sort", input: { z: 1, a: 2, m: 3, A: 4 } },
  { name: "nested", input: { outer: { c: 1, a: 2, b: 3 }, alpha: [3, 1, 2] } },
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
];

function encode(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "bigint") return JSON.stringify(`${v.toString(10)}n`);
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("non-finite number");
    if (Number.isInteger(v)) return v.toString(10);
    return JSON.stringify(v);
  }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(encode).join(",")}]`;
  if (typeof v === "object") {
    const entries = Object.entries(v)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, value]) => `${JSON.stringify(k)}:${encode(value)}`).join(",")}}`;
  }
  throw new Error("unsupported type: " + typeof v);
}

const vectors = inputs.map(({ name, input }) => ({ name, input, output: encode(input) }));

console.log(
  JSON.stringify(
    {
      spec: "engine canonicalJson @pd/sim/src/canonical.ts (sorted keys, no whitespace, BigInt → quoted-with-n, undefined → null at root)",
      vectors,
    },
    null,
    2,
  ),
);
