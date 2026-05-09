#!/usr/bin/env node
// Regenerate `reference-vectors/streams.json`. Inlines the engine's PCG32 +
// SHA-256 protocol from `packages/sim/src/rng/`; the harness streams.test.ts
// asserts engine output matches the committed vectors, so a divergence in
// either side fails the test loudly.

import { createHash } from "node:crypto";

function sha256(buf) {
  return new Uint8Array(createHash("sha256").update(buf).digest());
}

const TEXT_ENCODER = new TextEncoder();
const SEP = 0x1f;
const MULT = 6364136223846793005n;
const DEFAULT_INC = 1442695040888963407n;
const MASK64 = (1n << 64n) - 1n;
const MASK32 = (1n << 32n) - 1n;

function encodePart(part) {
  if (part instanceof Uint8Array) return part;
  if (typeof part === "string") return TEXT_ENCODER.encode(part);
  if (typeof part === "bigint") return TEXT_ENCODER.encode(part.toString(10));
  if (typeof part === "number") {
    if (!Number.isInteger(part)) throw new Error("seed parts must be integers");
    return TEXT_ENCODER.encode(part.toString(10));
  }
  throw new Error("unsupported seed part type");
}

function joinParts(parts) {
  const enc = parts.map(encodePart);
  let total = 0;
  for (const e of enc) total += e.length;
  const out = new Uint8Array(total + Math.max(0, enc.length - 1));
  let i = 0;
  for (let k = 0; k < enc.length; k += 1) {
    if (k > 0) {
      out[i] = SEP;
      i += 1;
    }
    out.set(enc[k], i);
    i += enc[k].length;
  }
  return out;
}

function deriveU64(...parts) {
  const digest = sha256(joinParts(parts));
  let acc = 0n;
  for (let i = 7; i >= 0; i -= 1) acc = (acc << 8n) | BigInt(digest[i] ?? 0);
  return acc;
}

function pcg32FromU64(seed) {
  let inc = DEFAULT_INC & MASK64;
  if ((inc & 1n) === 0n) inc = (inc | 1n) & MASK64;
  let state = (seed + inc) & MASK64;
  state = (state * MULT + inc) & MASK64;
  return {
    nextU32() {
      const old = state;
      state = (old * MULT + inc) & MASK64;
      const xorshifted = (((old >> 18n) ^ old) >> 27n) & MASK32;
      const rot = Number(old >> 59n) & 31;
      const out = ((xorshifted >> BigInt(rot)) | (xorshifted << BigInt((32 - rot) & 31))) & MASK32;
      return Number(out);
    },
  };
}

function streamRng(streamId, seed, dayIndex, ...extra) {
  return pcg32FromU64(deriveU64("stream", streamId, seed, dayIndex, ...extra));
}

const cases = [
  { stream_id: "arrivals", seed_hex: "0xC0FFEE", day_index: 0, extra: [] },
  { stream_id: "arrivals", seed_hex: "0xC0FFEE", day_index: 1, extra: ["loc_1"] },
  { stream_id: "weather", seed_hex: "0xC0FFEE", day_index: 0, extra: [] },
  { stream_id: "reviews", seed_hex: "0xC0FFEE", day_index: 7, extra: ["loc_1"] },
  { stream_id: "ai_moves", seed_hex: "0xBEEF01", day_index: 3, extra: ["ai_brand_a"] },
  { stream_id: "events", seed_hex: "0xDEAD01", day_index: 28, extra: [] },
  { stream_id: "marketing_noise", seed_hex: "0x4A4D01", day_index: 14, extra: ["campaign_x"] },
];

const vectors = cases.map((c) => {
  const seed = BigInt(c.seed_hex);
  const u64 = deriveU64("stream", c.stream_id, seed, c.day_index, ...c.extra);
  const rng = streamRng(c.stream_id, seed, c.day_index, ...c.extra);
  const outputs = [];
  for (let i = 0; i < 8; i += 1) outputs.push(rng.nextU32());
  return {
    stream_id: c.stream_id,
    seed_hex: c.seed_hex,
    day_index: c.day_index,
    extra: c.extra,
    derived_u64_hex: "0x" + u64.toString(16).toUpperCase().padStart(16, "0"),
    first_8_u32: outputs,
  };
});

console.log(
  JSON.stringify(
    {
      protocol: 'engine: deriveU64("stream", streamId, seed, dayIndex, ...extra) → pcg32FromU64',
      pcg32_inc_hex: "0x" + DEFAULT_INC.toString(16).toUpperCase(),
      pcg32_mult_hex: "0x" + MULT.toString(16).toUpperCase(),
      part_separator: "0x1F (US)",
      vectors,
    },
    null,
    2,
  ),
);
