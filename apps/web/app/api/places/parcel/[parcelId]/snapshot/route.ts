import { NextResponse, type NextRequest } from "next/server";

import type { ParcelSnapshot } from "@/lib/parcel/snapshot";

// Anonymized overlay for MapShell (ADR-0004). Never proxies raw Google payloads.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ parcelId: string }> },
) {
  const { parcelId } = await context.params;

  // Deterministic Phase 1 fixture — internal POI ids only (no Places refs).
  const snapshot: ParcelSnapshot = {
    parcelId,
    center: { lat: 37.7749, lng: -122.4194 },
    zoom: 12,
    pois: [
      { id: `${parcelId}:poi-a`, lat: 37.78, lng: -122.41, shortLabel: "North spot" },
      { id: `${parcelId}:poi-b`, lat: 37.77, lng: -122.43, shortLabel: "West spot" },
      { id: `${parcelId}:poi-c`, lat: 37.765, lng: -122.405, shortLabel: "South spot" },
      { id: `${parcelId}:poi-d`, lat: 37.772, lng: -122.425, shortLabel: "Dense A" },
      { id: `${parcelId}:poi-e`, lat: 37.7725, lng: -122.4245, shortLabel: "Dense B" },
      { id: `${parcelId}:poi-f`, lat: 37.773, lng: -122.424, shortLabel: "Dense C" },
    ],
  };

  return NextResponse.json(snapshot, { status: 200 });
}
