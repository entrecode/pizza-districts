import { createBrowserClient as supabaseCreateBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env/client";

// Browser-safe Supabase client (publishable key, RLS-protected). ADR-0001 §3.
// Safe to import from client components.
export function createBrowserClient() {
  return supabaseCreateBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
