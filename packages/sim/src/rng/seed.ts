// SHA-256 → u64 LE seed derivation per ADR-0003 §4.1.
// All named-seed derivation in the reducer flows through `deriveU64`.
// Sync (pure JS) so the reducer stays synchronous.

import { sha256 } from "@noble/hashes/sha256";

const TEXT_ENCODER = new TextEncoder();

function encode(part: string | number | bigint | Uint8Array): Uint8Array {
  if (part instanceof Uint8Array) return part;
  if (typeof part === "string") return TEXT_ENCODER.encode(part);
  if (typeof part === "number") {
    if (!Number.isInteger(part)) {
      throw new Error("seed parts must be integers (got non-integer number)");
    }
    return TEXT_ENCODER.encode(part.toString(10));
  }
  return TEXT_ENCODER.encode(part.toString(10));
}

// Concatenates parts with a `` (US) byte separator so
// `("ab", "c")` and `("a", "bc")` cannot collide in the digest input.
function joinParts(parts: ReadonlyArray<string | number | bigint | Uint8Array>): Uint8Array {
  const SEP = 0x1f;
  const encoded = parts.map(encode);
  let total = 0;
  for (const e of encoded) total += e.length;
  const out = new Uint8Array(total + Math.max(0, encoded.length - 1));
  let i = 0;
  for (let k = 0; k < encoded.length; k += 1) {
    if (k > 0) {
      out[i] = SEP;
      i += 1;
    }
    const seg = encoded[k];
    if (seg) {
      out.set(seg, i);
      i += seg.length;
    }
  }
  return out;
}

// SHA-256(parts) truncated to its first 8 bytes interpreted as little-endian u64.
export function deriveU64(...parts: Array<string | number | bigint | Uint8Array>): bigint {
  const digest = sha256(joinParts(parts));
  let acc = 0n;
  for (let i = 7; i >= 0; i -= 1) {
    acc = (acc << 8n) | BigInt(digest[i] ?? 0);
  }
  return acc;
}

// Convenience aliases that mirror formula-sheet §3 seed sources.
export const brandSeed = (userId: string, brandName: string): bigint =>
  deriveU64("brand", userId, brandName);

export const daySeed = (brandSeedValue: bigint, dayIndex: number): bigint =>
  deriveU64("day", brandSeedValue, dayIndex);

export const aiSeedFor = (worldSeed: bigint, aiBrandId: string, dayIndex: number): bigint =>
  deriveU64("ai", worldSeed, aiBrandId, dayIndex);

export const poiSeedFor = (worldSeed: bigint, poiId: string): bigint =>
  deriveU64("poi", worldSeed, "poi", poiId);

export const reviewSeedFor = (
  daySeedValue: bigint,
  locationId: string,
  dayIndex: number,
): bigint => deriveU64("review", daySeedValue, locationId, dayIndex, "review");
