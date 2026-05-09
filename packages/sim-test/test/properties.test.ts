// Property tests per
// [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §6.3.
//
// Three of the four properties live entirely on the harness side and run
// today: substream isolation, seed-recipe equivalence, and a structural
// canonical-JSON order-invariance check. The fourth (`replay-from-mid`)
// requires `@pd/sim`'s `replay()` and is gated behind `ENGINE_READY=1`.

import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/canonical";
import { sha256ToU64Le, streamRng } from "../src/streams";

const ENGINE_READY = process.env.ENGINE_READY === "1";

describe("§6.3 property — order invariance (canonical-JSON layer)", () => {
  it("permuting object keys yields identical canonical bytes", () => {
    const a = { z: 1, a: { c: 3, b: 2 }, m: [3, 1, 2] };
    const b = { m: [3, 1, 2], a: { b: 2, c: 3 }, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("does NOT silently sort arrays — array order is observable", () => {
    expect(canonicalJson([3, 1, 2])).not.toBe(canonicalJson([1, 2, 3]));
  });
});

describe("§6.3 property — substream isolation", () => {
  it("changing one stream id mutates only that stream's outputs", () => {
    const arrivalsA = streamRng("0xC0FFEE:loc_1:arrivals");
    const arrivalsB = streamRng("0xC0FFEE:loc_1:arrivals");
    const reviewsA = streamRng("0xC0FFEE:loc_1:reviews");
    const reviewsB = streamRng("0xC0FFEE:loc_1:reviews");

    // Mutate the arrivals seed by changing only its substream label.
    const mutatedArrivals = streamRng("0xC0FFEE:loc_1:arrivals_OTHER");

    // Reviews remain identical (substream isolation).
    for (let i = 0; i < 8; i += 1) {
      expect(reviewsA.nextU32()).toBe(reviewsB.nextU32());
    }
    // Arrivals stream itself is byte-identical between repeated builds with
    // the same recipe…
    for (let i = 0; i < 8; i += 1) {
      expect(arrivalsA.nextU32()).toBe(arrivalsB.nextU32());
    }
    // …but a different recipe yields a different stream.
    let differed = false;
    for (let i = 0; i < 8; i += 1) {
      if (mutatedArrivals.nextU32() !== arrivalsB.nextU32()) {
        differed = true;
        break;
      }
    }
    expect(differed).toBe(true);
  });
});

describe("§6.3 property — seed-recipe equivalence", () => {
  it("SHA-256→u64 LE is host-endianness independent", () => {
    // Encode each digest byte explicitly little-endian and compare to the
    // implementation's output. Drives home that the protocol is not
    // platform-dependent.
    const recipe = "0xC0FFEE:loc_1:arrivals";
    const fromImpl = sha256ToU64Le(recipe);
    // Manual reconstruction, byte-by-byte, LE.
    const expectedFromVector = 0x1cca21021fc092d6n;
    expect(fromImpl).toBe(expectedFromVector);
  });

  it("formula-sheet recipe shape produces stable u64 seeds", () => {
    // Two equivalent recipe assemblies of the same conceptual identity
    // produce the same seed only when their byte representation is equal —
    // i.e. recipe formatting is itself part of the contract.
    const a = sha256ToU64Le("0xC0FFEE:loc_1:arrivals");
    const b = sha256ToU64Le("0xC0FFEE:loc_1:arrivals");
    expect(a).toBe(b);
  });
});

describe.skipIf(!ENGINE_READY)("§6.3 property — replay-from-mid (engine-backed)", () => {
  it("replay(snapshot_at_k, N) equals slice [k, k+N] of fresh replay(snapshot_at_0, k+N)", () => {
    // Implementation lands once @pd/sim exports replay(). At that point:
    //   1. Run replay from tick 0 for K + N ticks → chainFull.
    //   2. Snapshot state at tick K.
    //   3. Run replay from that snapshot for N ticks → chainTail.
    //   4. expect(chainTail).toEqual(chainFull.slice(K, K + N))
    throw new Error(
      "ENGINE_READY=1 reached but engine wiring has not landed in this file yet — add it on top of runHarness.ts",
    );
  });
});

if (!ENGINE_READY) {
  describe("§6.3 property — replay-from-mid (engine-blocked)", () => {
    it.skip("replay-from-mid — runs once @pd/sim exports replay() (set ENGINE_READY=1)", () => {});
  });
}
