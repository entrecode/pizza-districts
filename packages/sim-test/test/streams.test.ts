// streamRng — PCG32 + SHA-256→u64 LE reference-vector tests.
//
// These vectors are the engine ↔ harness contract. If the engine's own
// `streamRng` produces different `first_8_u32` for any vector, the
// determinism harness will surface it as a clean failure here before any
// per-tick replay runs.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PCG32_DEFAULT_INC, pcg32, sha256ToU64Le, streamRng } from "../src/streams";

interface StreamVector {
  seed_recipe: string;
  sha256_hex: string;
  seed_u64_hex: string;
  pcg32_inc_hex: string;
  first_8_u32: number[];
}

interface VectorFile {
  protocol: string;
  inc_hex: string;
  multiplier_hex: string;
  vectors: StreamVector[];
}

const VECTORS_PATH = join(__dirname, "..", "reference-vectors", "streams.json");
const VECTORS = JSON.parse(readFileSync(VECTORS_PATH, "utf8")) as VectorFile;

describe("streamRng — protocol metadata", () => {
  it("uses sha256-u64le-then-pcg32-default-inc", () => {
    expect(VECTORS.protocol).toBe("sha256-u64le-then-pcg32-default-inc");
  });

  it("default increment matches PCG32_DEFAULT_INC", () => {
    expect(BigInt(VECTORS.inc_hex)).toBe(PCG32_DEFAULT_INC);
  });

  it("multiplier is the canonical PCG default", () => {
    expect(BigInt(VECTORS.multiplier_hex)).toBe(0x5851f42d4c957f2dn);
  });
});

describe("streamRng — reference vectors", () => {
  for (const v of VECTORS.vectors) {
    it(`SHA-256→u64 LE matches for "${v.seed_recipe}"`, () => {
      expect(`0x${sha256ToU64Le(v.seed_recipe).toString(16).toUpperCase().padStart(16, "0")}`).toBe(
        v.seed_u64_hex,
      );
    });

    it(`first 8 u32 outputs match for "${v.seed_recipe}"`, () => {
      const rng = streamRng(v.seed_recipe);
      const got: number[] = [];
      for (let i = 0; i < 8; i += 1) got.push(rng.nextU32());
      expect(got).toEqual(v.first_8_u32);
    });
  }
});

describe("streamRng — engine convention", () => {
  it("two RNGs from the same recipe produce identical streams", () => {
    const a = streamRng("0xC0FFEE:loc_1:arrivals");
    const b = streamRng("0xC0FFEE:loc_1:arrivals");
    for (let i = 0; i < 16; i += 1) {
      expect(a.nextU32()).toBe(b.nextU32());
    }
  });

  it("different recipes produce different streams", () => {
    const a = streamRng("0xC0FFEE:loc_1:arrivals");
    const b = streamRng("0xC0FFEE:loc_2:arrivals");
    let differed = false;
    for (let i = 0; i < 4; i += 1) {
      if (a.nextU32() !== b.nextU32()) {
        differed = true;
        break;
      }
    }
    expect(differed).toBe(true);
  });

  it("nextFloat01 stays in [0, 1)", () => {
    const rng = streamRng("pizza-districts");
    for (let i = 0; i < 100; i += 1) {
      const v = rng.nextFloat01();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("forces even increments to odd (PCG32 invariant)", () => {
    const seed = 0x123456789abcdef0n;
    const evenInc = 0x14057b7ef767814en; // one less than default — even
    const a = pcg32(seed, evenInc);
    const b = pcg32(seed, evenInc | 1n);
    expect(a.nextU32()).toBe(b.nextU32());
  });
});
