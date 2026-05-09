// Canonical-JSON — engine surface contract test.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJson } from "@pd/sim";

interface CanonicalVector {
  name: string;
  /** Input passed verbatim to canonicalJson. Recorded as JSON in the
   *  reference-vectors file so the regenerator script and the test agree. */
  input: unknown;
  output: string;
}

interface VectorFile {
  spec: string;
  vectors: CanonicalVector[];
}

const VECTORS = JSON.parse(
  readFileSync(join(__dirname, "..", "reference-vectors", "canonical.json"), "utf8"),
) as VectorFile;

describe("canonicalJson (engine) — invariants", () => {
  it("sorts object keys lexicographically", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("emits no whitespace", () => {
    const out = canonicalJson({ a: [1, 2, { b: 3 }] });
    expect(out).toBe('{"a":[1,2,{"b":3}]}');
    expect(out).not.toMatch(/\s/);
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow();
  });

  it('emits BigInts as `"<digits>n"` (engine convention)', () => {
    expect(canonicalJson(123n)).toBe('"123n"');
  });

  it("treats undefined as null at the root", () => {
    expect(canonicalJson(undefined)).toBe("null");
  });

  it("drops undefined-valued object keys", () => {
    expect(canonicalJson({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
  });

  it("renders integers verbatim with no scientific notation", () => {
    expect(canonicalJson(1234567)).toBe("1234567");
    expect(canonicalJson(-1234567)).toBe("-1234567");
  });
});

describe("canonicalJson (engine) — reference vectors", () => {
  for (const v of VECTORS.vectors) {
    it(`${v.name}`, () => {
      expect(canonicalJson(v.input)).toBe(v.output);
    });
  }
});
