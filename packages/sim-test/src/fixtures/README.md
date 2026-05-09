# Determinism harness fixtures

Engine fixtures live in TypeScript (`engineFixtures.ts`) because the
engine's `SimState` carries `bigint` fields (`worldSeed`, `brandSeed`)
that JSON cannot represent natively.

| Factory                      | Tier   | Spec ref                                                                                |
| ---------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `fixtureFreshBrand`          | Tier-1 | §6.1 `passive-1d` / `passive-7d` / `passive-28d` / `with-events-7d`                     |
| `fixtureNearBankrupt`        | Tier-1 | §6.1 `bankruptcy-edge-28d`, §6.2 `replay-bankruptcy-365`                                |
| `fixtureThreeLocations`      | Tier-1 | §6.1 `multi-location-7d`, §6.2 `replay-three-loc-365`                                   |

Tier-2-only fixtures still pending engine-shape lock for the formula-sheet
event scripts (PIZ-48 follow-up):

- `replay-marketing-heavy-365` — needs the marketing event script
- `replay-aggressive-ai-365` — needs the AI competitor profiles
- `replay-price-sweep-180` — needs `pp_target_price_eur` + per-brand price tiers
- `all-features-365` — needs every event type at least once

For now those Tier-2 cases reuse the closest available factory; once the
spec-driven event scripts land, swap them in via `engineFixtures.ts`.

## §3.1 attribute-leak guard

`validateFixture` checks for legacy `parcels[].location_snapshot.attributes`
keys (`resident_density`, `competition_pressure`). The current engine
`SimState` has no `parcels` field, so the guard is a no-op on engine
fixtures and only fires on hand-shaped legacy objects. The guard remains
because the v0.6 spec calls it out as a Tier-1 case; if the engine
SimState gains a `parcels` field later, this guard begins firing for
real. PIZ-48 names the scope-vs-spec divergence.
