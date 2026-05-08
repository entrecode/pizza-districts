// Re-export of @pd/sim's public type surface for the web app + Edge Functions.
// ADR-0003 §6/§8 — keep one canonical declaration in @pd/sim, mirrored here so
// callers can `import type { SimState } from "@pd/shared"`.

export type {
  AiCompetitor,
  BrandState,
  LedgerCategory,
  LedgerEntry,
  LocationState,
  LookupTables,
  MarketingCampaign,
  Money,
  RatingScaled,
  RunTickResult,
  SimConstants,
  SimState,
  TickEvent,
  TickEventKind,
  TickInputs,
  TickRecord,
  WeatherCode,
  WorldState,
} from "@pd/sim";
