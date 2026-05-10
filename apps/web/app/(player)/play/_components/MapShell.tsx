"use client";

import type { Cluster, ClusterStats, MarkerClusterer, Renderer } from "@googlemaps/markerclusterer";
import { useEffect, useRef, useState } from "react";

import { mapsRuntimeEnabled } from "@/lib/maps/runtime";
import type { ParcelSnapshot } from "@/lib/parcel/snapshot";
import { usePlayStore } from "@/lib/store/play-store";

export type MapShellProps = {
  parcelId?: string;
};

function advancedClusterRenderer(
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement,
): Renderer {
  return {
    render(cluster: Cluster, stats: ClusterStats, map: google.maps.Map) {
      const { count, position } = cluster;
      const mean = stats.clusters.markers.mean;
      const hot = count > Math.max(10, mean);
      const div = document.createElement("div");
      div.className = hot
        ? "flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-full border-2 border-white bg-danger text-caption font-semibold text-danger-ink shadow-elevation-md"
        : "flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-full border-2 border-white bg-brand-primary text-caption font-semibold text-brand-primary-ink shadow-elevation-md";
      div.textContent = String(count);
      return new AdvancedMarkerElement({
        map,
        position,
        content: div,
        zIndex: 100_000 + count,
      });
    },
  };
}

export function MapShell({ parcelId = "phase1-demo" }: MapShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const setSelectedParcelId = usePlayStore((s) => s.setSelectedParcelId);
  const [mode, setMode] = useState<"loading" | "inactive" | "ready" | "error">("loading");

  useEffect(() => {
    const host = rootRef.current;
    if (!host) return;

    if (!mapsRuntimeEnabled()) {
      setMode("inactive");
      return;
    }

    let cancelled = false;
    let clusterer: MarkerClusterer | null = null;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];

    void (async () => {
      try {
        setMode("loading");
        const res = await fetch(`/api/places/parcel/${encodeURIComponent(parcelId)}/snapshot`);
        if (!res.ok) throw new Error(`snapshot ${res.status}`);
        const snapshot = (await res.json()) as ParcelSnapshot;

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
        const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STYLE_ID;
        if (!apiKey || !mapId) throw new Error("maps env");

        const { importLibrary, setOptions } = await import("@googlemaps/js-api-loader");
        setOptions({ key: apiKey, v: "weekly" });

        const { Map } = await importLibrary("maps");
        const { AdvancedMarkerElement } = await importLibrary("marker");

        const { MarkerClusterer, SuperClusterAlgorithm } = await import("@googlemaps/markerclusterer");

        if (cancelled) return;

        const map = new Map(host, {
          center: snapshot.center,
          zoom: snapshot.zoom,
          mapId,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          keyboardShortcuts: false,
        });

        for (const poi of snapshot.pois) {
          const content = document.createElement("div");
          content.className =
            "flex h-3 w-3 cursor-pointer rounded-full border-2 border-white bg-brand-primary shadow-elevation-sm ring-1 ring-black/10";
          content.title = poi.shortLabel;

          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: poi.lat, lng: poi.lng },
            content,
            gmpClickable: true,
            title: poi.shortLabel,
          });

          marker.addListener("click", () => {
            setSelectedParcelId(poi.id);
            window.dispatchEvent(
              new CustomEvent("parcel:selected", { detail: { parcelId: poi.id } }),
            );
          });

          markers.push(marker);
        }

        clusterer = new MarkerClusterer({
          map,
          markers,
          algorithm: new SuperClusterAlgorithm({ maxZoom: 16, radius: 56 }),
          renderer: advancedClusterRenderer(AdvancedMarkerElement),
        });

        await new Promise<void>((resolve) => {
          const idleListener = map.addListener("idle", () => {
            idleListener.remove();
            resolve();
          });
        });

        if (!cancelled) setMode("ready");
      } catch {
        if (!cancelled) setMode("error");
      }
    })();

    return () => {
      cancelled = true;
      clusterer?.clearMarkers();
      clusterer?.setMap(null);
      clusterer = null;
      for (const m of markers) {
        m.map = null;
      }
      markers.length = 0;
      host.replaceChildren();
    };
  }, [parcelId, setSelectedParcelId]);

  return (
    <div className="relative h-full min-h-[12rem] w-full">
      <div ref={rootRef} className="absolute inset-0" aria-label="District map" role="application" />

      {mode === "loading" ? (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center bg-surface-muted/40"
          aria-busy="true"
        >
          <p className="rounded-pill bg-surface px-4 py-2 text-label text-text-muted shadow-elevation-sm">
            Loading map…
          </p>
        </div>
      ) : null}

      {mode === "inactive" ? (
        <div className="absolute inset-0 grid place-items-center bg-surface-muted p-6 text-center">
          <div className="max-w-[18rem]">
            <p className="font-display text-h3">Map offline</p>
            <p className="mt-2 text-body text-text-muted">
              Set <code className="font-mono text-mono-sm">NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY</code> and{" "}
              <code className="font-mono text-mono-sm">NEXT_PUBLIC_GOOGLE_MAPS_STYLE_ID</code> to load the vector
              basemap (skipped in CI).
            </p>
          </div>
        </div>
      ) : null}

      {mode === "error" ? (
        <div className="absolute inset-0 grid place-items-center bg-surface-muted p-6 text-center">
          <p className="text-body text-danger">Could not initialize the map. Check the browser console.</p>
        </div>
      ) : null}
    </div>
  );
}

export default MapShell;
