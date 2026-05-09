// RFC 8785 / JCS canonical JSON serializer.
//
// Output rules (per RFC 8785 §3 and ECMA-262 Number serialization):
// - object keys sorted by UTF-16 code-unit order
// - no whitespace, no trailing commas, no BOM
// - strings emitted with JSON.stringify (RFC 8259 §7 escapes match RFC 8785)
// - numbers in ECMAScript shortest round-trip form
// - -0 normalized to "0" (RFC 8785 §3.2.2.3)
// - non-finite numbers and undefined throw — they are not representable in JCS
//
// Determinism harness consumes this for `tick_hash` inputs and artifact files
// (per [determinism-harness](/PIZ/issues/PIZ-9#document-determinism-harness) §3, §4).

export class CanonicalJsonError extends Error {
  override name = "CanonicalJsonError";
}

export function canonicalJson(value: unknown): string {
  return encode(value);
}

export function canonicalJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(encode(value));
}

function encode(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) {
    throw new CanonicalJsonError("undefined is not representable in JCS");
  }
  switch (typeof v) {
    case "boolean":
      return v ? "true" : "false";
    case "number":
      return encodeNumber(v);
    case "bigint":
      // BigInts are not JSON-native, but we accept them as integers for
      // engine-side u64 seeds. Caller is responsible for preventing overflow.
      return v.toString();
    case "string":
      return JSON.stringify(v);
    case "object": {
      if (Array.isArray(v)) return encodeArray(v);
      return encodeObject(v as Record<string, unknown>);
    }
    default:
      throw new CanonicalJsonError(`unsupported type: ${typeof v}`);
  }
}

function encodeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new CanonicalJsonError(`non-finite number is not representable in JCS: ${n}`);
  }
  // RFC 8785 §3.2.2.3 — collapse -0 to 0.
  if (Object.is(n, -0)) return "0";
  // ECMAScript Number.prototype.toString already produces a shortest
  // round-trip representation; this matches RFC 8785 §3.2.2 for all
  // values our state surface emits (integer cents, integer-scaled
  // ratings, fixed-point Q-values).
  return String(n);
}

function encodeArray(arr: readonly unknown[]): string {
  const parts: string[] = [];
  for (const item of arr) parts.push(encode(item));
  return "[" + parts.join(",") + "]";
}

function encodeObject(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj);
  // Skip undefined-valued keys (matches JSON.stringify; RFC 8785 §3.2.3
  // says members are "the JSON members" — undefined is not JSON).
  const present = keys.filter((k) => obj[k] !== undefined);
  present.sort(compareCodeUnits);
  const parts: string[] = [];
  for (const k of present) {
    parts.push(JSON.stringify(k) + ":" + encode(obj[k]));
  }
  return "{" + parts.join(",") + "}";
}

function compareCodeUnits(a: string, b: string): number {
  // String comparison in ECMAScript is already by UTF-16 code unit, which
  // matches RFC 8785 §3.2.3 (sort by member-name code points using UTF-16
  // surrogate-pair–aware ordering — equivalent to plain string compare).
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
