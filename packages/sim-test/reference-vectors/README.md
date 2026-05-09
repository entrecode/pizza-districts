# Reference vectors — engine ↔ harness contract

These JSON files are the byte-for-byte agreement between the determinism
harness in `packages/sim-test/` and the engine in `packages/sim/`. Both sides
assert against the same vectors. Drift in either implementation surfaces as
a clean test failure.

| File                             | Surface                                                                                                | Status                                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `streams.json`                   | `streamRng(seed_recipe)` → first 8 `u32` per recipe                                                    | **landed** (this PR)                                                                                                                                                                            |
| `canonical.json`                 | RFC 8785 / JCS canonical-JSON output for fixed inputs                                                  | **landed** (this PR)                                                                                                                                                                            |
| `tick_hash.json`                 | `tick_hash = hash(prevHash ‖ canonicalJson(events) ‖ canonicalJson(stateDelta))` per spec §6.4 step 11 | **engine-blocked** — gated on `@pd/sim` exporting `runTick` and pinning the hash function (BLAKE3 per §6.4 / spec). Captured under [PIZ-31](/PIZ/issues/PIZ-31) follow-up once `runTick` lands. |
| `lut/exp_clamped_q12.json`       | `LUT_PRICE_PULL` table values + 64-point precision-vs-`Math.exp` reference                             | **engine-blocked** — gated on PIZ-24 LUT.                                                                                                                                                       |
| `lut/one_minus_exp_neg_q16.json` | `LUT_MARKETING_REACH` table values + precision reference                                               | **engine-blocked** — gated on PIZ-24 LUT.                                                                                                                                                       |

## Regenerating `streams.json` and `canonical.json`

The generators live next to the implementations and share their logic so the
vectors stay in sync with the harness code:

```bash
# Streams (uses node:crypto, no extra deps)
node packages/sim-test/scripts/gen-streams-vectors.mjs > packages/sim-test/reference-vectors/streams.json

# Canonical-JSON
node packages/sim-test/scripts/gen-canonical-vectors.mjs > packages/sim-test/reference-vectors/canonical.json
```

Anyone changing the algorithm MUST regenerate the vectors AND update the
spec section that authorizes the change. A regen without spec sign-off is a
determinism-contract break and should be rejected at PR review.
