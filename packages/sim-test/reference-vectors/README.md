# Reference vectors — engine ↔ harness contract

These JSON files are the byte-for-byte agreement between `@pd/sim` and the
determinism harness. Both sides assert against the same vectors. Drift in
either implementation surfaces as a clean test failure.

| File                               | Surface                                                                                | Status                          |
| ---------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------- |
| `streams.json`                     | `streamRng(streamId, seed, dayIndex, ...extra)` → first 8 `u32` per recipe             | landed                          |
| `canonical.json`                   | `canonicalJson` output for fixed inputs (engine convention; see notes)                 | landed                          |
| `tick-hash.json`                   | First N `tickHash` values from `replay()` for each Tier-1 fixture                      | landed                          |
| `lut/exp_clamped_q12.json`         | Anchor table dimensions + 64-point precision-vs-`Math.exp` reference (LUT_PRICE_PULL)  | landed                          |
| `lut/one_minus_exp_neg_q16.json`   | Anchor table dimensions + 64-point precision-vs-`Math.exp` reference (LUT_MARKETING_REACH) | landed                          |

## Engine canonical-JSON conventions (codified in vectors)

These choices land via [PIZ-34](/PIZ/issues/PIZ-34); the harness defers to
them because they're the bytes that hit production:

- BigInt → `"<digits>n"` (string-quoted with `n` suffix). Differs from
  RFC 8785 / JCS — see PIZ-48 for the divergence trail.
- `undefined` at the root → `"null"` (RFC 8785 says throw).
- Object keys sorted lexicographically; no whitespace; integer numbers
  emitted via `toString(10)`.

## Engine RNG protocol (codified in vectors)

- `deriveU64(...parts)`: each part is UTF-8 encoded; parts are joined by a
  single `0x1F` (US) byte; SHA-256; first 8 bytes interpreted as
  little-endian u64.
- `streamRng(streamId, seed, dayIndex, ...extra)`:
  `pcg32FromU64(deriveU64("stream", streamId, seed, dayIndex, ...extra))`.
- PCG32 init: `state = (seed + inc) & MASK64; state = (state * MULT + inc) & MASK64;`
  using `MULT = 0x5851F42D4C957F2D` and `inc = 0x14057B7EF767814F`.

## Regenerating vectors

```bash
# streams + canonical (algorithm inlined; no sim deps)
node packages/sim-test/scripts/gen-streams-vectors.mjs > packages/sim-test/reference-vectors/streams.json
node packages/sim-test/scripts/gen-canonical-vectors.mjs > packages/sim-test/reference-vectors/canonical.json

# tick-hash + LUT vectors (require @pd/sim — driven via vitest)
CAPTURE_VECTORS=1 pnpm --filter @pd/sim-test exec vitest run test/__capture-vectors.test.ts
```

Anyone changing the engine's canonical-JSON, streamRng, or per-step
behavior MUST regenerate the vectors AND name the change in the spec PR
(determinism-harness §3 / §6 / §6.4 / §6.5). Drift without spec sign-off
is a contract break.
