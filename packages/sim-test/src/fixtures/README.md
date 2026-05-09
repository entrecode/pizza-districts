# Determinism harness fixtures

Each fixture is a `FixtureFile` per `src/types.ts`:

```
{ brand_seed: "0x...", world_seed?: "0x...", initial_state: SimState, events?: SimEvent[] }
```

| Fixture                         | Tier           | Spec ref                                                            |
| ------------------------------- | -------------- | ------------------------------------------------------------------- |
| `init-fresh-brand.json`         | Tier-1         | §6.1 `passive-1d` / `passive-7d` / `passive-28d` / `with-events-7d` |
| `init-near-bankrupt.json`       | Tier-1, Tier-2 | §6.1 `bankruptcy-edge-28d`, §6.2 `replay-bankruptcy-365`            |
| `init-price-sweep.json`         | Tier-2         | §6.2 `replay-price-sweep-180` (GD §6 review)                        |
| `init-v0_5-attribute-leak.json` | Tier-1         | §3.1 negative — must throw at validateFixture time                  |

Stub fixtures still pending engine-shape lock (CTO PIZ-24/PIZ-32):

- `init-three-locations.json` — Tier-1 `multi-location-7d`, Tier-2 `replay-three-loc-365`
- `init-vs-aggressive-ai.json` — Tier-2 `replay-aggressive-ai-365`
- `init-marketing-burn.json` — Tier-2 `replay-marketing-heavy-365`
- `init-all-features.json` — Tier-2 `all-features-365`
- `events-rent-menu-marketing.json`, `events-mixed.json` — companion event scripts

These ship in follow-up PRs once `@pd/sim`'s `SimState` schema has landed
(see [PIZ-31](/PIZ/issues/PIZ-31) dependencies §1).
