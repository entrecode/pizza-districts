// streamRng — engine surface contract test.
//
// `@pd/sim` owns the byte-level PCG32 + SHA-256 protocol; the harness just
// asserts that the engine's surface is what the spec promised and that
// reference vectors held under `reference-vectors/streams.json` regenerate
// stably from it.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RESERVED_STREAM_IDS, deriveU64, pcg32FromU64, streamRng } from "@pd/sim";

interface StreamVector {
  stream_id: string;
  seed_hex: string;
  day_index: number;
  extra: ReadonlyArray<string | number>;
  derived_u64_hex: string;
  first_8_u32: number[];
}

interface VectorFile {
  protocol: string;
  vectors: StreamVector[];
}

const VECTORS = JSON.parse(
  readFileSync(join(__dirname, "..", "reference-vectors", "streams.json"), "utf8"),
) as VectorFile;

describe("streamRng — engine surface", () => {
  it("exposes the canonical reserved stream ids", () => {
    expect([...RESERVED_STREAM_IDS]).toEqual([
      "arrivals",
      "weather",
      "reviews",
      "ai_moves",
      "events",
      "staff",
      "marketing_noise",
    ]);
  });

  it("rejects unknown stream ids", () => {
    expect(() => streamRng("not_a_stream" as never, 0n, 0)).toThrow();
  });
});

describe("streamRng — reference vectors", () => {
  for (const v of VECTORS.vectors) {
    it(`(${v.stream_id}, ${v.seed_hex}, ${v.day_index}) — first 8 u32 stable`, () => {
      const seed = BigInt(v.seed_hex);
      const rng = streamRng(v.stream_id as never, seed, v.day_index, ...v.extra);
      const got: number[] = [];
      for (let i = 0; i < 8; i += 1) got.push(rng.nextU32());
      expect(got).toEqual(v.first_8_u32);
    });

    it(`(${v.stream_id}, ${v.seed_hex}, ${v.day_index}) — deriveU64 matches`, () => {
      const seed = BigInt(v.seed_hex);
      const u64 = deriveU64("stream", v.stream_id, seed, v.day_index, ...v.extra);
      expect(`0x${u64.toString(16).toUpperCase().padStart(16, "0")}`).toBe(v.derived_u64_hex);
    });
  }
});

describe("streamRng — substream isolation", () => {
  it("two RNGs from the same recipe produce identical streams", () => {
    const a = streamRng("arrivals", 0xc0ffeen, 0);
    const b = streamRng("arrivals", 0xc0ffeen, 0);
    for (let i = 0; i < 16; i += 1) expect(a.nextU32()).toBe(b.nextU32());
  });

  it("different recipes yield different streams", () => {
    const a = streamRng("arrivals", 0xc0ffeen, 0);
    const b = streamRng("reviews", 0xc0ffeen, 0);
    let differed = false;
    for (let i = 0; i < 4; i += 1) {
      if (a.nextU32() !== b.nextU32()) {
        differed = true;
        break;
      }
    }
    expect(differed).toBe(true);
  });

  it("PCG32 init is independent of seed bit pattern at low order", () => {
    const a = pcg32FromU64(1n);
    const b = pcg32FromU64(2n);
    expect(a.nextU32()).not.toBe(b.nextU32());
  });
});
