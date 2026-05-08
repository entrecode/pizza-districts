import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

// ADR-0001 §5. Two jobs only:
//   1. Refresh Supabase session cookie on every request.
//   2. For /(admin)/** — require auth + role=admin; 404 otherwise.
// Game-route auth lives in app/(game)/layout.tsx, not here.

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);

  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith("/admin");
  if (isAdminPath) {
    const role = (user?.app_metadata as { role?: string } | undefined)?.role;
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (role !== "admin") {
      // 404, not 403 — don't disclose admin existence.
      return new NextResponse(null, { status: 404 });
    }
  }

  return response;
}

// Skip Next internals and static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt)$).*)",
  ],
};
