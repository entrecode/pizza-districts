import { describe, expect, it } from "vitest";
import { hashSeed, mulberry32 } from "./prng";

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("emits values in [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("differs across seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toEqual(b());
  });
});

describe("hashSeed", () => {
  it("is stable for the same input", () => {
    expect(hashSeed("pizza-districts")).toEqual(hashSeed("pizza-districts"));
  });

  it("differs across inputs", () => {
    expect(hashSeed("a")).not.toEqual(hashSeed("b"));
  });
});
