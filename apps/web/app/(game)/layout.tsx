import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// Game-route auth check (ADR-0001 §5/§6). Lives here, not in middleware,
// so we keep edge fast and use the typed client.
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return <div className="min-h-screen bg-surface text-text">{children}</div>;
}
