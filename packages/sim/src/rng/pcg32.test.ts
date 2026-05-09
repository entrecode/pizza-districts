import { describe, expect, it } from "vitest";
import { pcg32FromU64, pcg32FromU64Pair } from "./pcg32";
import { deriveU64 } from "./seed";
import { streamRng } from "./index";

describe("pcg32", () => {
  it("is deterministic across instances for the same seed", () => {
    const a = pcg32FromU64(42n);
    const b = pcg32FromU64(42n);
    const seqA = Array.from({ length: 8 }, () => a.nextU32());
    const seqB = Array.from({ length: 8 }, () => b.nextU32());
    expect(seqA).toEqual(seqB);
  });

  it("differs across distinct seeds", () => {
    const a = pcg32FromU64(1n);
    const b = pcg32FromU64(2n);
    expect(a.nextU32()).not.toEqual(b.nextU32());
  });

  it("nextU32 returns 32-bit unsigned integers", () => {
    const r = pcg32FromU64(0xdeadbeefn);
    for (let i = 0; i < 100; i += 1) {
      const v = r.nextU32();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("nextFloat is in [0, 1)", () => {
    const r = pcg32FromU64(7n);
    for (let i = 0; i < 200; i += 1) {
      const v = r.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("nextIntBelow rejects invalid bounds", () => {
    const r = pcg32FromU64(1n);
    expect(() => r.nextIntBelow(0)).toThrow();
    expect(() => r.nextIntBelow(-1)).toThrow();
    expect(() => r.nextIntBelow(1.5)).toThrow();
  });

  it("pair-stream selector produces disjoint sequences", () => {
    const a = pcg32FromU64Pair(1n, 1n);
    const b = pcg32FromU64Pair(1n, 3n);
    const seqA = Array.from({ length: 4 }, () => a.nextU32());
    const seqB = Array.from({ length: 4 }, () => b.nextU32());
    expect(seqA).not.toEqual(seqB);
  });
});

describe("deriveU64", () => {
  it("is stable across calls", () => {
    expect(deriveU64("brand", "user1", "Pizza Joe")).toEqual(
      deriveU64("brand", "user1", "Pizza Joe"),
    );
  });

  it("treats argument boundaries as significant", () => {
    expect(deriveU64("ab", "c")).not.toEqual(deriveU64("a", "bc"));
  });

  it("returns a 64-bit BigInt", () => {
    const v = deriveU64("test");
    expect(typeof v).toBe("bigint");
    expect(v).toBeGreaterThanOrEqual(0n);
    expect(v).toBeLessThan(1n << 64n);
  });
});

describe("streamRng", () => {
  it("rejects unknown stream ids", () => {
    // @ts-expect-error — testing runtime guard
    expect(() => streamRng("not-a-real-stream", 1n, 0)).toThrow();
  });

  it("produces distinct sequences across stream ids for the same seed", () => {
    const a = streamRng("arrivals", 99n, 0);
    const b = streamRng("weather", 99n, 0);
    expect(a.nextU32()).not.toEqual(b.nextU32());
  });

  it("produces distinct sequences across day_index for the same stream/seed", () => {
    const a = streamRng("arrivals", 99n, 0);
    const b = streamRng("arrivals", 99n, 1);
    expect(a.nextU32()).not.toEqual(b.nextU32());
  });
});
