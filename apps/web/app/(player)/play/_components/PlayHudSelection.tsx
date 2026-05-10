"use client";

import { usePlayStore } from "@/lib/stores/play-store";

export function PlayHudSelection() {
  const selected = usePlayStore((s) => s.selectedParcelId);
  if (!selected) {
    return null;
  }
  return (
    <>
      {" "}
      · selected <span className="font-mono text-mono-sm text-text">{selected}</span>
    </>
  );
}
