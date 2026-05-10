"use client";

import type { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useEffect, useRef, useState } from "react";
import { clientEnv } from "@/lib/env/client";
import { buildPoiPinElement } from "@/lib/maps/poi-pin";
import type { ParcelSnapshotPoi, ParcelSnapshotResponse } from "@/lib/places/parcel-snapshot";
import { usePlayStore } from "@/lib/stores/play-store";

function onceMapIdle(map: google.maps.Map): Promise<void> {
  return new Promise((resolve) => {
    const listener = map.addListener("idle", () => {
      listener.remove();
      resolve();
    });
  });
}

export function MapShell({ parcelId }: { parcelId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectParcel = usePlayStore((s) => s.selectParcel);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const key = clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
    const mapId = clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_STYLE_ID;
    if (!key || !mapId) {
      setHint("Set NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY and NEXT_PUBLIC_GOOGLE_MAPS_STYLE_ID to load the map.");
      return;
    }

    let cancelled = false;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    let clusterer: MarkerClusterer | null = null;
    let idleCallbackId: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    async function init() {
      if (!containerRef.current) {
        return;
      }

      const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
      setOptions({ key, v: "weekly" });

      const { Map } = await importLibrary("maps");

      if (cancelled || !containerRef.current) {
        return;
      }

      const map = new Map(containerRef.current, {
        center: { lat: 37.7749, lng: -122.4194 },
        zoom: 14,
        mapId,
        gestureHandling: "greedy",
        isFractionalZoomEnabled: true,
      });

      const res = await fetch(`/api/places/parcel/${encodeURIComponent(parcelId)}/snapshot`);
      if (!res.ok) {
        throw new Error(`snapshot ${res.status}`);
      }
      if (cancelled) {
        return;
      }
      const snapshot = (await res.json()) as ParcelSnapshotResponse;
      if (cancelled) {
        return;
      }
      map.setCenter(snapshot.center);

      await onceMapIdle(map);
      if (cancelled) {
        return;
      }

      const { AdvancedMarkerElement } = await importLibrary("marker");
      if (cancelled) {
        return;
      }

      const { MarkerClusterer, SuperClusterAlgorithm } = await import("@googlemaps/markerclusterer");

      for (const poi of snapshot.pois as ParcelSnapshotPoi[]) {
        const pin = buildPoiPinElement(poi.label);
        const marker = new AdvancedMarkerElement({
          map: null,
          position: { lat: poi.lat, lng: poi.lng },
          content: pin,
          gmpClickable: true,
        });
        marker.addListener("gmp-click", () => {
          selectParcel(parcelId);
          window.dispatchEvent(new CustomEvent("parcel:selected", { detail: { parcelId } }));
        });
        markers.push(marker);
      }

      clusterer = new MarkerClusterer({
        map,
        markers,
        algorithm: new SuperClusterAlgorithm({}),
      });

      if (!cancelled && typeof window !== "undefined") {
        const w = window as Window & { __PD_MAP_READY_MS?: number };
        w.__PD_MAP_READY_MS = Math.round(performance.now());
      }
    }

    function startInit() {
      void init().catch(() => {
        if (!cancelled) {
          setHint("Could not initialize the map. Check the browser key and network.");
        }
      });
    }

    /** Defer Maps + clusterer so first paint / Lighthouse TBT are not dominated by API bootstrap. */
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleCallbackId = window.requestIdleCallback(startInit, { timeout: 600 });
    } else {
      timeoutHandle = setTimeout(startInit, 0);
    }

    return () => {
      cancelled = true;
      if (idleCallbackId !== undefined && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      clusterer?.clearMarkers();
      markers.length = 0;
    };
  }, [parcelId, selectParcel]);

  return (
    <section className="relative px-4 pb-6" aria-label="District map">
      {hint ? (
        <div className="rounded-card border border-border bg-surface-muted p-4 text-body text-text-muted">{hint}</div>
      ) : null}
      <div ref={containerRef} className="mt-2 h-[min(70vh,560px)] w-full overflow-hidden rounded-card border border-border shadow-elevation-sm" />
    </section>
  );
}
