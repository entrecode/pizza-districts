import dynamic from "next/dynamic";
import { Suspense } from "react";
import { MapFallback } from "./_components/MapFallback";
import { PlayHud } from "./_components/PlayHud";

const MapShell = dynamic(() => import("./_components/MapShell").then((m) => ({ default: m.MapShell })), {
  ssr: false,
  loading: () => <MapFallback />,
});

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ parcel?: string }> }) {
  const sp = await searchParams;
  const parcelId = sp.parcel?.trim() || "demo-parcel";

  return (
    <main className="flex min-h-screen flex-col">
      <PlayHud parcelId={parcelId} />
      <Suspense fallback={<MapFallback />}>
        <MapShell parcelId={parcelId} />
      </Suspense>
    </main>
  );
}
