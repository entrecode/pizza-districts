import Link from "next/link";

export default function GameDashboard() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-6 py-8">
      <h1 className="font-display text-h1 text-text">Dashboard</h1>
      <p className="text-body text-text-muted">Phase 1 scaffold — the game shell will live here.</p>
      <Link
        href="/play"
        className="rounded-button bg-brand-primary px-4 py-3 text-center text-label text-brand-primary-ink shadow-elevation-sm"
      >
        Open play (map)
      </Link>
    </main>
  );
}
