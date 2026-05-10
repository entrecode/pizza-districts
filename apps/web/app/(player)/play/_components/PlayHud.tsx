import Link from "next/link";
import { PlayHudSelection } from "./PlayHudSelection";

export function PlayHud({ parcelId }: { parcelId: string }) {
  return (
    <header className="relative z-10 flex flex-col gap-2 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-h3 text-text">Play</h1>
        <Link
          href="/dashboard"
          prefetch={false}
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Dashboard
        </Link>
      </div>
      <p className="text-caption text-text-muted">
        Parcel <span className="font-mono text-mono-sm text-text">{parcelId}</span>
        <PlayHudSelection />
      </p>
    </header>
  );
}
