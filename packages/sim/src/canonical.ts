// Canonical JSON encoder for hash inputs. ADR-0003 §4.3.
//
// Keys are sorted lexicographically at every object level. BigInts are encoded
// as `"<digits>n"` strings so the formula-sheet u64 seeds round-trip without
// floating-point loss. The output is deterministic across Node and Deno.

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | bigint
  | ReadonlyArray<CanonicalValue>
  | { readonly [key: string]: CanonicalValue };

export function canonicalJson(value: unknown): string {
  return encode(value as CanonicalValue);
}

function encode(value: CanonicalValue): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") return JSON.stringify(`${value.toString(10)}n`);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonicalJson: non-finite number");
    }
    if (Number.isInteger(value)) return value.toString(10);
    // Non-integer numbers are forbidden in tick math (ADR §4.1) but allowed in
    // event payloads as a defensive escape hatch. Normalize via toString to
    // avoid runtime-specific formatting drift.
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(encode).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, CanonicalValue>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${encode(v)}`).join(",")}}`;
  }
  throw new Error(`canonicalJson: unsupported value type ${typeof value}`);
}
