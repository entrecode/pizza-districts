// BLAKE3 chain hash. ADR-0003 §4.3.
// `tick_hash = blake3(prevHash || canonicalJson(events) || canonicalJson(stateDelta))`

import { blake3 } from "@noble/hashes/blake3";
import { bytesToHex } from "@noble/hashes/utils";

const TEXT_ENCODER = new TextEncoder();

export const ZERO_HASH: string = "0".repeat(64);

export function chainHash(prevHashHex: string, eventsJson: string, stateDeltaJson: string): string {
  const prev = hexToBytes(prevHashHex);
  const events = TEXT_ENCODER.encode(eventsJson);
  const delta = TEXT_ENCODER.encode(stateDeltaJson);
  const buf = new Uint8Array(prev.length + 1 + events.length + 1 + delta.length);
  let i = 0;
  buf.set(prev, i);
  i += prev.length;
  buf[i] = 0x1f;
  i += 1;
  buf.set(events, i);
  i += events.length;
  buf[i] = 0x1f;
  i += 1;
  buf.set(delta, i);
  return bytesToHex(blake3(buf));
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hexToBytes: odd hex length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error("hexToBytes: invalid hex");
    out[i] = byte;
  }
  return out;
}
