// Public type surface for @pd/sim. Mirrored on packages/shared so the web app
// and Edge Functions consume identical shapes.

export type WeatherCode = 0 | 1 | 2 | 3; // 0=clear, 1=cloud, 2=rain, 3=storm

export type Money = number; // integer cents
export type RatingScaled = number; // integer × 1000

export interface AiCompetitor {
  readonly id: string;
  readonly districtId: string;
  strength: number; // 0..1000 integer-scaled
  lastMoveTick: number;
}

export interface MarketingCampaign {
  readonly id: string;
  readonly channel: string;
  readonly districtId: string;
  remainingBudget: Money;
  reach: number; // integer-scaled awareness, 0..1_000_000
  active: boolean;
}

export interface LocationState {
  readonly id: string;
  capacity: number;
  conditionScaled: number; // 0..1000 integer
  ratingScaled: RatingScaled; // rolling avg, × 1000
  lastSales: number;
  lastServed: number;
  lastLost: number;
}

export interface BrandState {
  cashCents: Money;
  reputationScaled: number;
  rating30Scaled: RatingScaled;
  consecutiveNegativeCashDays: number;
  bankrupt: boolean;
}

export interface WorldState {
  weather: WeatherCode;
  weatherDay: number;
}

export interface SimConstants {
  readonly bankruptcyWindowDays: number; // formula sheet bankruptcy.window_days
  readonly rollingWindow: number; // formula sheet rating30.window (=30)
  readonly weeklyPeriodDays: number; // 7
  readonly marketingDecayPerDay: number; // integer-scaled, 0..10000 (=10000 → no decay)
}

export interface SimState {
  readonly engineVersion: number;
  readonly worldSeed: bigint;
  readonly brandSeed: bigint;
  readonly constants: SimConstants;
  dayIndex: number;
  world: WorldState;
  brand: BrandState;
  locations: LocationState[];
  marketing: MarketingCampaign[];
  ai: AiCompetitor[];
  ledger: LedgerEntry[];
}

export type LedgerCategory = "sales" | "cogs" | "rent" | "payroll" | "marketing" | "settlement";

export interface LedgerEntry {
  readonly tickIndex: number;
  readonly locationId: string | null;
  readonly category: LedgerCategory;
  readonly amountCents: Money; // signed; revenue positive, costs negative
}

export type TickEventKind =
  | "weather_changed"
  | "ai_move"
  | "marketing_decay"
  | "demand_resolved"
  | "finance_settled"
  | "review_posted"
  | "rating_updated"
  | "bankruptcy"
  | "narrative";

export interface TickEvent {
  readonly kind: TickEventKind;
  readonly tickIndex: number;
  readonly locationId?: string;
  readonly aiBrandId?: string;
  readonly campaignId?: string;
  readonly payload: Record<string, number | string | boolean | null>;
}

export interface TickRecord {
  readonly tickIndex: number;
  readonly engineVersion: number;
  readonly tickHash: string; // hex-encoded BLAKE3
  readonly events: ReadonlyArray<TickEvent>;
  readonly ledger: ReadonlyArray<LedgerEntry>;
  readonly stateSummary: Readonly<{
    cashCents: Money;
    rating30Scaled: RatingScaled;
    consecutiveNegativeCashDays: number;
    bankrupt: boolean;
    weather: WeatherCode;
  }>;
}

export interface TickInputs {
  readonly tickIndex: number;
}

export interface RunTickResult {
  readonly state: SimState;
  readonly events: ReadonlyArray<TickEvent>;
  readonly hash: string;
  readonly ledgerDelta: ReadonlyArray<LedgerEntry>;
  readonly record: TickRecord;
}

// LUT shims — populated by the sibling LUT issue. When `LUT_READY` is false,
// step3/step4 fall back to identity behavior (no demand, no marketing decay)
// so the rest of the pipeline still produces a stable hash.
export interface LookupTables {
  readonly LUT_READY: boolean;
  readonly priceQ12: ReadonlyArray<number>;
  readonly oneMinusExpNegQ16: ReadonlyArray<number>;
}

export const EMPTY_LUTS: LookupTables = Object.freeze({
  LUT_READY: false,
  priceQ12: Object.freeze([]) as unknown as ReadonlyArray<number>,
  oneMinusExpNegQ16: Object.freeze([]) as unknown as ReadonlyArray<number>,
});
