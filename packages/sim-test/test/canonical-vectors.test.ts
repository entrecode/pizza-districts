// Reference-vector test for the canonical-JSON encoder. The vectors are the
// engine ↔ harness contract; if the engine ports `canonicalJson` (or any
// other component depends on canonical bytes), it must match these.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/canonical";

interface CanonicalVector {
  name: string;
  input: unknown;
  output: string;
}
interface CanonicalVectorFile {
  spec: string;
  notes: string;
  vectors: CanonicalVector[];
}

const VECTORS = JSON.parse(
  readFileSync(join(__dirname, "..", "reference-vectors", "canonical.json"), "utf8"),
) as CanonicalVectorFile;

describe("canonical-JSON reference vectors", () => {
  for (const v of VECTORS.vectors) {
    it(`${v.name} matches the committed vector`, () => {
      expect(canonicalJson(v.input)).toBe(v.output);
    });
  }
});
