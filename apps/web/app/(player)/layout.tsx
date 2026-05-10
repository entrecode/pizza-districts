import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// Player shell — same auth gate as `(game)` (ADR-0001).
export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return <div className="min-h-screen bg-surface text-text">{children}</div>;
}
