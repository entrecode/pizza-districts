import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env/server";

export async function POST(_request: NextRequest) {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", env.NEXT_PUBLIC_SITE_URL), { status: 303 });
}
