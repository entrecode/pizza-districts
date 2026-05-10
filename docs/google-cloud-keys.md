# Google Cloud keys, restrictions, and secret wiring

Operational runbook for **PIZ-15** (Google Cloud key restrictions & secret wiring). Cross-check **ADR-0004** (Maps & Places — issue document) and the server/client boundary in code.

## Two credentials

| Credential                    | Env vars                                                                  | Where it runs                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Maps JavaScript (browser)** | `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_STYLE_ID` | Client bundle + `MapShell`; gated by `mapsRuntimeEnabled()` in `apps/web/lib/maps/runtime.ts`.          |
| **Places (server)**           | `GOOGLE_PLACES_SERVER_KEY`                                                | Route handlers under `app/api/places/*` and, when used, Supabase Edge Functions. Never `NEXT_PUBLIC_*`. |

Anything without the `NEXT_PUBLIC_` prefix must stay server-only (Vercel env **Sensitive**, never logged).

## Browser key — Google Cloud Console

1. **APIs & Services → Credentials → Create API key.**
2. **Application restrictions:** HTTP referrers (web sites). Add at least:
   - `http://localhost:3000/*` — local `pnpm dev`
   - `http://127.0.0.1:3000/*` — CI perf-gate (`wait-on` uses loopback; see `.github/workflows/ci.yml`)
   - `https://*.vercel.app/*` — Vercel preview deployments
   - Production origin(s), e.g. `https://your-domain.com/*`
3. **API restrictions:** Restrict key. Enable only what the Maps JS loader needs for vector `mapId` + Advanced Markers, typically **Maps JavaScript API** (and any additional Maps tiles APIs required by your Cloud Map ID — follow Console prompts). Do **not** enable Places, Geocoding, Directions, or Distance Matrix on this key.
4. **Map ID:** Create a Cloud **Map ID** (vector style) with **POI labels off** per product rules. The value is `NEXT_PUBLIC_GOOGLE_MAPS_STYLE_ID`.

## Server key — Places

1. **Separate API key** from the browser key.
2. **Application restrictions:** **None.** Server-side keys cannot use HTTP referrers. **IP restrictions** do not work with default Vercel serverless egress (addresses are not static). If you later attach static egress, you may tighten to those IPs; until then, rely on **API restrictions** + **secret storage** + rotation.
3. **API restrictions:** **Places API** (and only the methods you actually call). Phase 1 `app/api/places` is still a stub; keep the key narrow as real calls land.
4. **Field masks (when calling Places):** Prefer **Basic + Contact** on player-facing paths; **Atmosphere** (or equivalent rich fields) only on ingestion / infrequent refresh jobs — per PIZ-15 acceptance.

## Where secrets live

| Env var                               | Vercel                           | GitHub Actions                                                        | Supabase Edge                                                                      |
| ------------------------------------- | -------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Production, Preview, Development | Optional **Actions secret** — enables real Maps in `perf-gate`        | —                                                                                  |
| `NEXT_PUBLIC_GOOGLE_MAPS_STYLE_ID`    | Same                             | Optional **Actions secret** (or Variables; value is public in bundle) | —                                                                                  |
| `GOOGLE_PLACES_SERVER_KEY`            | Same (**Sensitive**)             | Optional **Actions secret** for server routes in CI                   | `supabase secrets set GOOGLE_PLACES_SERVER_KEY` when an Edge Function calls Places |

**GitHub:** Repository → **Settings → Secrets and variables → Actions**. Names must match the left column exactly so `.github/workflows/ci.yml` can inject them into the `perf-gate` job.

When all three are set, `perf-gate` builds with real values: `mapsRuntimeEnabled()` is true, Maps JS loads, and `packages/perf/tests/play-budget.spec.ts` **does not skip** Maps payload / first-map-paint assertions. When any are unset, the workflow falls back to `ci-placeholder` (current default).

## Local development

Copy `.env.example` → `.env.local` and fill real values. Never commit `.env.local`.

## CI safety

Workflow env uses placeholders for `verify` and other jobs. Only `perf-gate` overrides Maps/Places vars when secrets exist. Do not echo key values in logs; CI already uses synthetic Supabase placeholders at the workflow level.

## Rotation

Target **90 days** or immediately on suspected leak. Rotate in Google Cloud, then update Vercel, GitHub, and Supabase in the same change window. Record policy changes in the ADR/issue thread, not only in this file.

## Unblocking Maps smoke / perf

**PIZ-73** (Maps smoke / ceiling assertions) needs real browser + map ID (and Places when tests hit that path). After provisioning keys per above, add the GitHub Actions secrets so `perf-gate` exercises the same code path as preview/prod-shaped environments.
