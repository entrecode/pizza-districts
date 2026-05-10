// Anonymized parcel POI overlay (ADR-0004). No Google place IDs on the wire.

export type ParcelPoi = {
  id: string;
  lat: number;
  lng: number;
  shortLabel: string;
};

export type ParcelSnapshot = {
  parcelId: string;
  center: { lat: number; lng: number };
  zoom: number;
  pois: ParcelPoi[];
};
