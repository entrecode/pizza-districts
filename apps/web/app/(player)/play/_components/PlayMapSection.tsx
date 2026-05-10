"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { MapFallback } from "./MapFallback";

const MapShell = dynamic(() => import("./MapShell").then((m) => ({ default: m.MapShell })), {
  ssr: false,
  loading: () => <MapFallback />,
});

export function PlayMapSection({ parcelId }: { parcelId: string }) {
  return (
    <Suspense fallback={<MapFallback />}>
      <MapShell parcelId={parcelId} />
    </Suspense>
  );
}
