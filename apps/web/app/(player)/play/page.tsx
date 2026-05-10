import { PlayHud } from "./_components/PlayHud";
import { PlayMapSection } from "./_components/PlayMapSection";

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ parcel?: string }> }) {
  const sp = await searchParams;
  const parcelId = sp.parcel?.trim() || "demo-parcel";

  return (
    <main className="flex min-h-screen flex-col">
      <PlayHud parcelId={parcelId} />
      <PlayMapSection parcelId={parcelId} />
    </main>
  );
}
