// RFC 8785 / JCS canonical-JSON behavior. Captures the minimum set of
// invariants the determinism harness depends on: stable key ordering,
// no whitespace, -0 collapse, rejection of non-finite numbers.

import { describe, expect, it } from "vitest";

import { canonicalJson, CanonicalJsonError } from "../src/canonical";

describe("canonicalJson", () => {
  it("sorts object keys by UTF-16 code unit order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ ä: 1, z: 2 })).toBe('{"z":2,"ä":1}');
  });

  it("emits no whitespace", () => {
    const out = canonicalJson({ a: [1, 2, { b: 3 }] });
    expect(out).toBe('{"a":[1,2,{"b":3}]}');
    expect(out).not.toMatch(/\s/);
  });

  it("collapses -0 to 0 (RFC 8785 §3.2.2.3)", () => {
    expect(canonicalJson(-0)).toBe("0");
    expect(canonicalJson({ a: -0 })).toBe('{"a":0}');
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow(CanonicalJsonError);
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow(CanonicalJsonError);
    expect(() => canonicalJson(Number.NEGATIVE_INFINITY)).toThrow(CanonicalJsonError);
  });

  it("rejects undefined at the root", () => {
    expect(() => canonicalJson(undefined)).toThrow(CanonicalJsonError);
  });

  it("drops undefined-valued object keys (matches JSON.stringify)", () => {
    expect(canonicalJson({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
  });

  it("escapes string control characters per RFC 8259", () => {
    expect(canonicalJson('a"\nb')).toBe('"a\\"\\nb"');
  });

  it("is byte-stable across input key insertion order", () => {
    const a = canonicalJson({ z: 1, a: 2, m: 3 });
    const b = canonicalJson({ m: 3, a: 2, z: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"m":3,"z":1}');
  });

  it("renders integer cents as integers (no scientific notation)", () => {
    expect(canonicalJson(1234567)).toBe("1234567");
    expect(canonicalJson(-1234567)).toBe("-1234567");
  });

  it("handles BigInt as decimal integer literal", () => {
    expect(canonicalJson(123n)).toBe("123");
    expect(canonicalJson(0xffffffffffffffffn)).toBe("18446744073709551615");
  });

  it("handles arrays in declared order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });
});
