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
// Uses the anon key + RLS so calls are still scoped to the current session.
export async function createServerClient() {
  const cookieStore = await cookies();
  return supabaseCreateServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Verbose aliases — kept so call sites that already use the prefixed names
// (e.g., older layout imports, ADR-0001 examples) continue to compile.
export { createServerClient as createSupabaseServerClient };
export { createServiceRoleClient as createSupabaseServiceRoleClient };
