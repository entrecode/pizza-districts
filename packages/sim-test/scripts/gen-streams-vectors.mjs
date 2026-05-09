#!/usr/bin/env node
// Regenerate `reference-vectors/streams.json`. The generator inlines the
// PCG32 + SHA-256 protocol so it has no transpilation step. If you change
// `src/streams.ts`, rerun this and commit the new vectors AND update
// `seeding-protocol.md` to authorize the change.

import { createHash } from "node:crypto";

const PCG_MULT = 6364136223846793005n;
const PCG32_DEFAULT_INC = 1442695040888963407n;
const U64_MASK = 0xffffffffffffffffn;
const U32_MASK = 0xffffffffn;

function readU64Le(buf, offset) {
  let v = 0n;
  for (let i = 7; i >= 0; i -= 1) v = (v << 8n) | BigInt(buf[offset + i]);
  return v & U64_MASK;
}

function sha256ToU64Le(input) {
  return readU64Le(createHash("sha256").update(input, "utf8").digest(), 0);
}

function pcg32(seed, inc = PCG32_DEFAULT_INC) {
  let oddInc = (inc | 1n) & U64_MASK;
  let state = seed & U64_MASK;
  state = (state * PCG_MULT + oddInc) & U64_MASK;
  return {
    nextU32() {
      const old = state;
      state = (state * PCG_MULT + oddInc) & U64_MASK;
      const xorshifted = (((old >> 18n) ^ old) >> 27n) & U32_MASK;
      const rot = Number((old >> 59n) & 31n);
      const left = Number(xorshifted >> BigInt(rot));
      const right = Number((xorshifted << BigInt((32 - rot) & 31)) & U32_MASK);
      return (left | right) >>> 0;
    },
  };
}

function streamRng(recipe) {
  return pcg32(sha256ToU64Le(recipe), PCG32_DEFAULT_INC);
}

const recipes = [
  "",
  "pizza-districts",
  "0xC0FFEE:loc_1:arrivals",
  "0xC0FFEE:loc_1:reviews",
  "0xC0FFEE::weather",
  "0xBEEF01:loc_3:ai_moves",
  "0xDEAD01:::events",
];

const vectors = recipes.map((r) => {
  const sha = createHash("sha256").update(r, "utf8").digest();
  const seedHex =
    "0x" + sha.subarray(0, 8).reverse().toString("hex").toUpperCase().padStart(16, "0");
  const rng = streamRng(r);
  const outputs = [];
  for (let i = 0; i < 8; i += 1) outputs.push(rng.nextU32());
  return {
    seed_recipe: r,
    sha256_hex: sha.toString("hex"),
    seed_u64_hex: seedHex,
    pcg32_inc_hex: "0x" + PCG32_DEFAULT_INC.toString(16).toUpperCase(),
    first_8_u32: outputs,
  };
});

console.log(
  JSON.stringify(
    {
      protocol: "sha256-u64le-then-pcg32-default-inc",
      inc_hex: "0x" + PCG32_DEFAULT_INC.toString(16).toUpperCase(),
      multiplier_hex: "0x" + PCG_MULT.toString(16).toUpperCase(),
      vectors,
    },
    null,
    2,
  ),
);
