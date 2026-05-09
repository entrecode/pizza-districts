// Re-export the engine's canonical-JSON encoder so the harness and the
// engine share a single byte contract. ADR-0003 §4.3 picks the encoder; the
// harness must mirror, not parallel.
//
// Note: the engine's encoder differs from the spec's RFC 8785 / JCS subset
// in two ways (captured in PIZ-48):
//   - BigInt → `"<digits>n"` (string-quoted with `n` suffix), not bare digits.
//   - undefined at the root → `"null"`, not throw.
// Both are engine choices that landed under [PIZ-34](/PIZ/issues/PIZ-34); the
// harness defers to the engine because the byte contract is what runs in
// production.

export { canonicalJson } from "@pd/sim";

export class CanonicalJsonError extends Error {
  override name = "CanonicalJsonError";
}
