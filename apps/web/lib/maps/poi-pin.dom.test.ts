import { describe, expect, it } from "vitest";
import { buildParcelSnapshotResponse } from "../places/parcel-snapshot";
import { RAW_GOOGLE_PLACE_NAMES_FOR_QA } from "../places/raw-fixture";
import { buildPoiPinElement } from "./poi-pin";

describe("POI pin DOM (user-visible path)", () => {
  it("marker labels from the parcel snapshot never match raw Google fixture names", () => {
    const snap = buildParcelSnapshotResponse("dom-integration-parcel");
    const pins = snap.pois.map((p) => buildPoiPinElement(p.label));
    const fragment = document.createElement("div");
    for (const pin of pins) {
      fragment.appendChild(pin);
    }
    document.body.appendChild(fragment);

    const text = fragment.textContent ?? "";
    for (const raw of RAW_GOOGLE_PLACE_NAMES_FOR_QA) {
      expect(text.includes(raw)).toBe(false);
    }

    fragment.remove();
  });
});
