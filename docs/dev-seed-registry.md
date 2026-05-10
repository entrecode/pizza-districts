# Dev-seed identifier registry

**Owner:** CTO. **Purpose:** every string a build artifact (or first-paint
SSR HTML) MUST NOT contain on a public-build cycle. QA's grep against this
registry is the deterministic green/red signal for row 12 of the
[Pre-Public-Build Checklist](/PIZ/issues/PIZ-54#document-pre-public-build-checklist)
("Build hygiene — dev seeds disabled").

> If you add a new dev-seed identifier anywhere in the repo or seed pipelines
> (synthetic POI prefix, test user email, dev-only sentinel UUID, dev-only
> Supabase row marker, etc.) you MUST add it here in the same PR. CI does not
> enforce this — it is a CTO discipline. The PR template carries a one-line
> reminder.

## Verification recipe (informational — QA owns the tooling per [PIZ-61](/PIZ/issues/PIZ-61) "Out of scope")

QA's row-12 step against any candidate public build:

1. Build `apps/web` (`pnpm --filter @pd/web build`) and capture both the
   `apps/web/.next` output tree and the first-paint SSR HTML for every primary
   route on a clean profile (no cookies, no localStorage, incognito).
2. Grep both corpora for every literal and every regex listed in the
   "Identifiers" section below.
3. **0 hits = green. ≥ 1 hit = red** — file a row-12 failure remediation issue
   citing the offending string and the file/route it surfaced in.

The registry intentionally lists strings that come from test-only workspace
packages (e.g. `@pd/sim-test`) too, even though those packages are not
declared as `apps/web` dependencies. They should never appear in the build by
construction; the grep is the safety net that proves it.

## Scope of grep

| Corpus | Path / source | In scope |
|---|---|---|
| Build artifact | `apps/web/.next/**` (server + static, excluding source maps if not shipped) | Yes |
| First-paint SSR HTML | `curl` against every primary route on a clean profile | Yes |
| Source tree | `apps/**`, `packages/**`, `supabase/**` source files | **No** — they are allowed to contain dev seeds; only build output / SSR matters |
| Test artifacts | `packages/sim-test/reference-vectors/**`, `packages/sim-test/test/**` | **No** — never shipped |

## Identifiers

Every entry below is grep-able as a literal string OR as the named regex.
Where a regex is given, prefer it over the example literal because future
seed pipelines may extend the family.

### 1. Synthetic POI IDs and POI-name prefixes

POI seed pipelines do not exist yet (the v0 schema in `supabase/migrations`
does not define a `pois` table). When they land, every synthetic POI MUST
carry one of these prefixes and be added below.

| Pattern | Example | Source |
|---|---|---|
| `^dev_` | `dev_loc_42` | reserved for any future POI seed under a dev profile |
| `^qa_` | `qa_canary_loc` | reserved for QA-shaped POIs (paired with `qa_canary` telemetry per [PIZ-62](/PIZ/issues/PIZ-62)) |
| `^test_` | `test_loc_3x3_grid` | reserved for engine/RLS test fixtures |
| `^smoke_` | `smoke_loc_001` | reserved for smoke-seed pipelines (cf. `supabase/seed/smoke_engine_v0.sql`) |

Grep regex: `\b(dev|qa|test|smoke)_[A-Za-z0-9_]+\b`

### 2. Test user IDs and email conventions

| Identifier | Source |
|---|---|
| `smoke@pizza-districts.local` | `supabase/seed/smoke_engine_v0.sql:13` |
| `a@test.local` | `supabase/tests/database/0010_engine_v0_schema.test.sql:76` |
| `b@test.local` | `supabase/tests/database/0010_engine_v0_schema.test.sql:77` |
| Email pattern `*@test.local` | reserved for any future pgTAP/RLS test user |
| Email pattern `*@*.local` | reserved for local-only seed users (the smoke seed uses `*.pizza-districts.local`) |
| Email pattern `*@example.com` | reserved by convention for any future doc/example user |

Grep regex (emails): `[A-Za-z0-9._%+-]+@(test\.local|example\.com|[A-Za-z0-9.-]*pizza-districts\.local)\b`

### 3. Sentinel UUIDs

These UUIDs live in dev/test seed files and pgTAP fixtures. They are
deliberately patterned (all-`a`, all-`1`, etc.) so they cannot be confused
with `gen_random_uuid()` output and so a grep finds them all.

| UUID | Role | Source |
|---|---|---|
| `aaaa0000-0000-0000-0000-000000000001` | smoke user | `supabase/seed/smoke_engine_v0.sql` |
| `aaaa0000-0000-0000-0000-000000000002` | smoke save | `supabase/seed/smoke_engine_v0.sql` |
| `aaaa0000-0000-0000-0000-000000000003` | smoke brand | `supabase/seed/smoke_engine_v0.sql` |
| `11111111-1111-1111-1111-111111111111` | pgTAP user A | `supabase/tests/database/0010_engine_v0_schema.test.sql` |
| `22222222-2222-2222-2222-222222222222` | pgTAP user B | `supabase/tests/database/0010_engine_v0_schema.test.sql` |
| `33333333-3333-3333-3333-333333333333` | pgTAP save A | `supabase/tests/database/0010_engine_v0_schema.test.sql` |
| `44444444-4444-4444-4444-444444444444` | pgTAP brand A | `supabase/tests/database/0010_engine_v0_schema.test.sql` |
| `55555555-5555-5555-5555-555555555555` | pgTAP save B | `supabase/tests/database/0010_engine_v0_schema.test.sql` |
| `66666666-6666-6666-6666-666666666666` | pgTAP brand B | `supabase/tests/database/0010_engine_v0_schema.test.sql` |
| `77777777-7777-7777-7777-777777777777` | pgTAP negative-test save id | `supabase/tests/database/0010_engine_v0_schema.test.sql` |
| `88888888-8888-8888-8888-888888888888` | pgTAP negative-test brand id | `supabase/tests/database/0010_engine_v0_schema.test.sql` |

Grep alternation (POSIX ERE — works in any `grep -E` / `rg`):
`\b(aaaa0000-0000-0000-0000-[0-9a-f]{12}|11111111-1111-1111-1111-111111111111|22222222-2222-2222-2222-222222222222|33333333-3333-3333-3333-333333333333|44444444-4444-4444-4444-444444444444|55555555-5555-5555-5555-555555555555|66666666-6666-6666-6666-666666666666|77777777-7777-7777-7777-777777777777|88888888-8888-8888-8888-888888888888)\b`

### 4. Engine-version sentinels

These string values appear in `engine_version` columns and are markers for
non-production saves/ticks. Production saves write a real semver shipped by
the engine package; any of these strings in build output indicates a leak.

| Value | Source |
|---|---|
| `0.0.0-smoke` | `supabase/seed/smoke_engine_v0.sql` |
| `0.0.0-test` | `supabase/tests/database/0010_engine_v0_schema.test.sql` |
| `0.0.0-test-touched` | `supabase/tests/database/0010_engine_v0_schema.test.sql` |
| `0.0.0-trigger-check` | `supabase/tests/database/0010_engine_v0_schema.test.sql` |
| `tampered` / `tampered-by-A` | `supabase/tests/database/0010_engine_v0_schema.test.sql` (negative-test markers) |

Grep regex: `\b0\.0\.0-(smoke|test|test-touched|trigger-check)\b|\btampered(-by-[A-Z])?\b`

### 5. Determinism-harness fixture IDs and seed hex

Lives in `packages/sim-test`, which is a test-only workspace package and is
NOT a declared dependency of `@pd/web`. These strings should never appear in
a build artifact; if they do, a tree-shaker or import boundary is broken.

| Identifier | Source |
|---|---|
| `init-fresh-brand` | `packages/sim-test/src/fixtures/engineFixtures.ts` |
| `init-near-bankrupt` | `packages/sim-test/src/fixtures/engineFixtures.ts` |
| `init-three-locations` | `packages/sim-test/src/fixtures/engineFixtures.ts` |
| `0xC0FFEE` / `0xc0ffee` | brand-seed marker for `init-fresh-brand` |
| `0xDEAD01` / `0xdead01` | brand-seed marker for `init-near-bankrupt` |
| `0xBEEF01` / `0xbeef01` | brand-seed marker for `init-three-locations` |
| `user-fixture` | `packages/sim/src/runTick.test.ts` (brand-seed input) |
| `loc_a` / `loc_b` / `loc_c` | `packages/sim-test/src/fixtures/engineFixtures.ts` (multi-location fixture) |
| `loc_1` | `packages/sim-test/src/fixtures/engineFixtures.ts` (single-location fixture) — generic, may collide with future production loc IDs; treat hits as orange and inspect context |
| `ai_brand_a` | `packages/sim-test/scripts/gen-streams-vectors.mjs` (AI-moves stream vector seed) |

Grep regex (case-insensitive): `\b(init-(fresh-brand|near-bankrupt|three-locations)|0x(c0ffee|dead01|beef01)|ai_brand_a|user-fixture)\b`

### 6. Dev-only Supabase row markers

The current schema has no soft-flag column convention (e.g. no `is_dev`,
`is_test`, `seed_source`). When such a marker is added, list both the
column name and the row values that mark a row as dev-only here. Until then
this section intentionally stays empty.

### 7. Dev-only feature seeds

No dev-only feature seeds exist in the build today (no feature-flag system
shipped yet). When the feature-flag system lands (row 14 of the checklist),
list any flag whose seeded "on" state would be a leak here. Until then this
section intentionally stays empty.

### 8. CI placeholder env values

These are placeholder env-variable VALUES used by the CI workflow so that
`zod`-validated env loads do not throw at typecheck time. They should never
end up in a build artifact (Next.js inlines `NEXT_PUBLIC_*` at build time;
the CI workflow uses placeholders only for `lint`/`typecheck`/`test`, not
for `build`). A hit here means a CI job built `apps/web` with placeholder
envs by mistake.

| Value | Source |
|---|---|
| `ci-placeholder` | `.github/workflows/ci.yml` |
| `http://localhost:54321` | `.github/workflows/ci.yml` (Supabase URL placeholder) |

Grep regex: `\bci-placeholder\b|\bhttp://localhost:54321\b`

## Maintenance commitment

The CTO updates this registry in the same PR that introduces a new
dev-seed identifier. The PR template carries a one-line reminder. If you
are reviewing a PR and notice a new sentinel UUID, test email, fixture id,
or seed prefix that is not listed above, request changes.
