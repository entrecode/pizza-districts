// §3.1 static fixture validation — v0.6 attribute contract.

import { describe, expect, it } from "vitest";

import { FixtureValidationError, validateFixture } from "../src/validateFixture";

function fx(parcels: unknown[]): unknown {
  return { parcels };
}

describe("validateFixture (v0.6 attribute contract)", () => {
  it("accepts a fixture with the canonical v0.6 key set", () => {
    expect(() =>
      validateFixture(
        fx([
          {
            id: "p_1",
            location_snapshot: {
              attributes: {
                foot_traffic: 50,
                purchasing_power: 60,
                visibility: 70,
                density: 80,
                competition: 30,
              },
            },
          },
        ]),
      ),
    ).not.toThrow();
  });

  it("rejects v0.5 legacy `resident_density` with the canonical message", () => {
    expect(() =>
      validateFixture(
        fx([
          {
            id: "p_42",
            location_snapshot: { attributes: { resident_density: 50 } },
          },
        ]),
      ),
    ).toThrow(/v0\.5 attribute leak.*p_42.*resident_density/);
  });

  it("rejects v0.5 legacy `competition_pressure`", () => {
    expect(() =>
      validateFixture(
        fx([
          {
            id: "p_z",
            location_snapshot: { attributes: { competition_pressure: 9 } },
          },
        ]),
      ),
    ).toThrow(/v0\.5 attribute leak/);
  });

  it("rejects unknown attribute keys (forward-compat fence)", () => {
    expect(() =>
      validateFixture(
        fx([
          {
            id: "p_z",
            location_snapshot: { attributes: { foot_traffic: 1, mystery_key: 5 } },
          },
        ]),
      ),
    ).toThrow(FixtureValidationError);
  });

  it("treats missing parcels array as no-op (Phase-1 minimal fixtures)", () => {
    expect(() => validateFixture({})).not.toThrow();
  });

  it("rejects non-object state", () => {
    expect(() => validateFixture(null)).toThrow(FixtureValidationError);
    expect(() => validateFixture(42)).toThrow(FixtureValidationError);
  });
});
