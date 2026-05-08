// Mulberry32 — small, fast, well-distributed deterministic PRNG.
// Same seed → same output, every run, every machine. Required by the
// simulation determinism mandate.

export type Prng = () => number;

export function mulberry32(seed: number): Prng {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a 32-bit. Stable hash for turning string seeds (run id, district id)
// into 32-bit ints suitable for mulberry32.
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
