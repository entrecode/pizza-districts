// TypeScript types for the simulation engine's Postgres RPC surface.
// PIZ-33 deliverable; consumed by the Edge Function `advance` endpoint
// and by `packages/sim-test/` (the determinism harness, PIZ-31).
//
// Hand-authored to mirror the SQL signatures in:
//   * supabase/migrations/0011_sim_load_state.sql
//   * supabase/migrations/0012_sim_commit_ticks.sql
//
// When those signatures change, this file changes in the same PR.
//
// Why hand-authored vs. supabase-gen output? `supabase gen types` is
// great for tables but emits opaque `Json` for jsonb args/returns — the
// Edge Function and harness need stronger shapes than that. Keeping
// this file authored gives us shared structural types both sides can
// import and that the type-checker actually enforces.

/** Subset of canonical UUID strings. */
export type Uuid = string;

/** Lowercase hex digest (no `0x` prefix). 32 bytes = 64 chars for `tick_hash`. */
export type Hex = string;

/**
 * Snapshot returned by `public.sim_load_state(save_id uuid) -> jsonb`.
 *
 * Authorization: authenticated callers may load only saves they own
 * (cross-player calls raise SQLSTATE `42501` insufficient_privilege).
 * service_role may load any save — this is the Edge Function path.
 *
 * `rng_seed` is serialized as a string when crossing the JSON boundary
 * because Postgres `BIGINT` can exceed `Number.MAX_SAFE_INTEGER`.
 * Callers that need numeric arithmetic must use `BigInt(rng_seed)`.
 */
export interface SimLoadStateResponse {
  save_id: Uuid;
  user_id: Uuid;
  brand_id: Uuid;
  /** ADR-0003 §4.2 brand_seed; immutable for the life of the save. */
  rng_seed: string;
  /** ADR-0003 §3 day_index. Monotonic; only `sim_commit_ticks` advances it. */
  current_tick: number;
  engine_version: string;
  created_at: string;
  updated_at: string;
}

/**
 * One element of `ticks_payload` for `sim_commit_ticks`.
 *
 * `tick_index` MUST be contiguous starting at `expected_current_tick`
 * (server validates and raises SQLSTATE `22023` invalid_parameter_value
 * on gap or out-of-order).
 *
 * `tick_hash` is a 64-character lowercase hex string (32 bytes), the
 * blake3 digest defined by ADR-0003 §4.3.
 */
export interface SimCommitTicksRow {
  tick_index: number;
  /** 64 hex chars = 32 bytes. ADR-0003 §4.3 blake3 digest. */
  tick_hash: Hex;
  events_jsonb: unknown;
  engine_version: string;
}

/**
 * Args for `public.sim_commit_ticks(save_id, expected_current_tick, ticks_payload) -> int`.
 *
 * Authorization: service_role only. Authenticated calls raise
 * SQLSTATE `42501` insufficient_privilege.
 *
 * Concurrency: `expected_current_tick` mismatch raises SQLSTATE
 * `PIZ01` — the Edge Function should map that to a 409 response and
 * have the client retry against a fresh `sim_load_state`.
 */
export interface SimCommitTicksArgs {
  save_id: Uuid;
  expected_current_tick: number;
  ticks_payload: SimCommitTicksRow[];
}

/** Return value: the new `saves.current_tick` after the batch. */
export type SimCommitTicksResponse = number;

/**
 * SQLSTATE the server raises when `expected_current_tick` does not
 * match the persisted `current_tick`. Clients should match on this
 * exact code rather than parsing the error message.
 */
export const OPTIMISTIC_LOCK_CONFLICT_SQLSTATE = "PIZ01";

/**
 * Convenience names for callers that match on the SQLSTATE rather
 * than parsing error messages.
 */
export type SimCommitTicksError =
  | { sqlstate: typeof OPTIMISTIC_LOCK_CONFLICT_SQLSTATE; kind: "optimistic_lock_conflict" }
  | { sqlstate: "42501"; kind: "insufficient_privilege" }
  | { sqlstate: "22023"; kind: "invalid_parameter_value" }
  | { sqlstate: "02000"; kind: "no_data_found" };

/**
 * Functions table for use with `supabase-js`'s
 * `createClient<Database>(...)` typed-client pattern. Mirrors
 * https://supabase.com/docs/reference/javascript/typescript-support.
 *
 * Example:
 *
 * ```ts
 * import type { SimRpcFunctions } from "@pd/schema/sim-rpc";
 * declare module "@/lib/supabase" {
 *   interface Database { public: { Functions: SimRpcFunctions } }
 * }
 * ```
 */
export interface SimRpcFunctions {
  sim_load_state: {
    Args: { save_id: Uuid };
    Returns: SimLoadStateResponse;
  };
  sim_commit_ticks: {
    Args: SimCommitTicksArgs;
    Returns: SimCommitTicksResponse;
  };
}
