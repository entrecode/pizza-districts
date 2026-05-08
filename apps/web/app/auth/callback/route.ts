import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env/server";

// Supabase OAuth / magic-link callback. ADR-0001 §6.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, env.NEXT_PUBLIC_SITE_URL));
    }
  }

  return NextResponse.redirect(new URL("/?auth=error", env.NEXT_PUBLIC_SITE_URL));
}
