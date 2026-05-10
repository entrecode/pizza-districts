import { describe, expect, it } from "vitest";
import { buildParcelSnapshotResponse } from "./parcel-snapshot";
import { RAW_GOOGLE_PLACE_NAMES_FOR_QA } from "./raw-fixture";

describe("buildParcelSnapshotResponse", () => {
  it("is deterministic for a fixed parcel id", () => {
    const a = buildParcelSnapshotResponse("parcel-seed-a");
    const b = buildParcelSnapshotResponse("parcel-seed-a");
    expect(a).toEqual(b);
  });

  it("never exposes raw Google-style place names from the QA fixture pool", () => {
    const snap = buildParcelSnapshotResponse("wide-sweep-parcel-99");
    const json = JSON.stringify(snap);
    for (const raw of RAW_GOOGLE_PLACE_NAMES_FOR_QA) {
      expect(json.includes(raw)).toBe(false);
    }
    for (const poi of snap.pois) {
      for (const raw of RAW_GOOGLE_PLACE_NAMES_FOR_QA) {
        expect(poi.label.includes(raw)).toBe(false);
      }
    }
  });
});
