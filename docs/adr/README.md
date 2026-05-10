# ADRs

Phase 1 ADRs live as `adr` issue documents on their tracking issue, not as files in this repo.
This directory exists so the layout from ADR-0001 is anchored, and to host any ADR that
later needs to ship inside the repo (e.g., bundled with a migration or a generator).

## Phase 1 index

- ADR-0001 — Repo & App Router topology — issue PIZ-4 (`adr` document).
- ADR-0002 — Supabase schema + RLS strategy — TBD.
- ADR-0003 — Simulation engine (deterministic, seeded; Edge Function vs Postgres) — TBD.
- ADR-0004 — Maps & Places strategy (server proxy boundary, POI shape) — TBD.
- ADR-0005 — Telemetry SDK contract + `qa_canary` verification flag — issue PIZ-62 (`adr` document).

When an ADR moves into this folder, name it `NNNN-kebab-title.md` and link it from this index.
