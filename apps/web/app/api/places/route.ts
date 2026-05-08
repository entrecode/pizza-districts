import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env/server";

// Google Places proxy (ADR-0001 §3, §4). Server-only — the Places key never
// leaves this handler. ADR-0004 will define the full POI shape and caching;
// this Phase 1 stub validates the boundary works end-to-end.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  const env = serverEnv();

  // Phase 1: prove the boundary, do not call Places yet.
  return NextResponse.json(
    {
      query: q,
      results: [],
      keyConfigured: Boolean(env.GOOGLE_PLACES_SERVER_KEY),
    },
    { status: 200 },
  );
}
