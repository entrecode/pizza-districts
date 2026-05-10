import { NextResponse, type NextRequest } from "next/server";
import { buildParcelSnapshotResponse } from "@/lib/places/parcel-snapshot";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/places/parcel/:id/snapshot — anonymized POI overlay for MapShell (ADR-0004 boundary).
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: parcelId } = await context.params;
  if (!parcelId) {
    return NextResponse.json({ error: "missing parcel id" }, { status: 400 });
  }

  const body = buildParcelSnapshotResponse(decodeURIComponent(parcelId));
  return NextResponse.json(body, { status: 200 });
}
