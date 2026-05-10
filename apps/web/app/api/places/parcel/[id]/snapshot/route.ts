import { NextResponse, type NextRequest } from "next/server";
import { buildParcelSnapshotResponse } from "@/lib/places/parcel-snapshot";

// GET /api/places/parcel/:id/snapshot — anonymized POI overlay for MapShell (ADR-0004 boundary).
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: parcelId } = await context.params;
  if (!parcelId) {
    return NextResponse.json({ error: "missing parcel id" }, { status: 400 });
  }

  const body = buildParcelSnapshotResponse(decodeURIComponent(parcelId));
  return NextResponse.json(body, { status: 200 });
}
