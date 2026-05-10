import "server-only";

import { cookies } from "next/headers";
import {
  createServerClient as supabaseCreateServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env/server";

type CookieMutation = { name: string; value: string; options: CookieOptions };

// Cookie-bound server client for server components, route handlers, middleware.
// Uses the publishable (RLS-protected) key so calls stay scoped to the current session.
export async function createServerClient() {
  const cookieStore = await cookies();
  return supabaseCreateServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieMutation[]) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}

// Service-role client. Bypasses RLS — never expose to a client component tree.
// Use only from app/api/* route handlers, Edge Functions, or admin-gated server code.
export function createServiceRoleClient() {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for createServiceRoleClient(). Add it under Vercel → Project Settings → Environment Variables (server-side, never NEXT_PUBLIC_).",
    );
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Verbose aliases — kept so call sites that already use the prefixed names
// (e.g., older layout imports, ADR-0001 examples) continue to compile.
export { createServerClient as createSupabaseServerClient };
export { createServiceRoleClient as createSupabaseServiceRoleClient };
