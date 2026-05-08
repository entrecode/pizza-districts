import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// Admin route gate (ADR-0001 §7). 404 (not 403) for non-admins —
// we don't disclose admin existence.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  if (!user || role !== "admin") {
    notFound();
  }

  return <div className="min-h-screen bg-surface text-text">{children}</div>;
}
