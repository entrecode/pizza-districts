# streamRng seeding protocol — engine ↔ harness contract

This file is the **byte-level** contract for how `seed_recipe` strings turn
into PCG32 substreams. The QA harness in `packages/sim-test/src/streams.ts`
implements it; the engine in `packages/sim/` MUST match it byte-for-byte
(per [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness)
§3 "Inputs" and §6.3 "Seed-recipe equivalence").

## Algorithm

1. Caller assembles a recipe string per the formula sheet, e.g.
   `"<day_seed>:<location_id>:arrivals"`. The harness does **not** prescribe
   recipe formatting; it hashes whatever bytes the caller passes.
2. Compute `digest = SHA-256(recipe_bytes_utf8)`.
3. Take `digest[0..8]` and interpret as a **little-endian u64**:
   `seed = digest[0] | (digest[1] << 8) | … | (digest[7] << 56)`.
4. Initialize PCG32 with:
   - `state = seed`
   - `inc = 0x14057B7EF767814F` (Knuth's golden constant, odd)
   - `multiplier = 0x5851F42D4C957F2D` (PCG default)
5. Run **one burn-in advance** before returning the RNG handle:
   `state = (state * multiplier + inc) & 0xFFFFFFFFFFFFFFFF`
6. Each `nextU32()` then runs the canonical PCG32 step on the OLD state and
   advances:

   ```
   old = state
   state = (state * multiplier + inc) & 0xFFFFFFFFFFFFFFFF
   xorshifted = (((old >> 18) ^ old) >> 27) & 0xFFFFFFFF
   rot = (old >> 59) & 31
   return ((xorshifted >> rot) | (xorshifted << ((32 - rot) & 31))) & 0xFFFFFFFF
   ```

`nextFloat01()` is `nextU32() / 2^32`. The engine SHOULD NOT use this in
hot reducer paths — `marketing_uplift` and `price_pull` use LUTs per
[ADR-0003 §4.1](/PIZ/issues/PIZ-6#document-adr).

## Why these choices

- **SHA-256, not BLAKE3:** the hash is at the substream-boundary only (one
  per recipe per tick, ~7 substreams). Performance is irrelevant; ubiquity
  matters. Every target runtime ships SHA-256.
- **First 8 bytes only:** PCG32 needs a 64-bit seed; the rest of the digest
  is wasted on this op. Truncation is fine because PCG32's burn-in mixes
  the seed against the (separately-seeded) increment before any output.
- **Little-endian:** matches the formula sheet convention and Intel/ARM
  defaults. The harness assembles bytewise so endianness of the host
  platform never enters the protocol.
- **Default increment shared across substreams:** the substream identity
  comes from the SHA-256 of the recipe; the increment is the same constant
  for every substream. That keeps the protocol minimal and is sufficient
  for substream isolation because the seeds are 64-bit independent. (PCG's
  multi-stream API is a different feature; we don't use it.)

## Reference vectors

`packages/sim-test/reference-vectors/streams.json` ships 7 recipe → first-8-u32
vectors. The harness asserts these in `test/streams.test.ts`. The engine
test suite MUST assert the same vectors against its own `streamRng`. Any
mismatch is an immediate determinism break.

## Cross-language note

If a future Rust/Go reducer ports this protocol, the byte-for-byte
contract above is the only thing it must match. The TypeScript
implementation here is a reference, not the source-of-truth — these
reference vectors are.
