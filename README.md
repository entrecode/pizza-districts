# Pizza Districts

Mobile-first browser tycoon game. Phase 1 bootstrap.

## Stack

Next.js App Router · TypeScript · Tailwind · Supabase (Auth/Postgres/RLS/Edge Functions) · Google Maps JS (client) · Google Places API (server-only).

Topology, server/client boundary, and route groups are pinned by [ADR-0001](docs/adr/) (issue document).

## Repo layout

```
apps/web/         Next.js App Router app
packages/sim/     Pure deterministic simulation engine
packages/shared/  Zod schemas + types shared between web and edge
supabase/         Migrations, Edge Functions, seed data
docs/             ADRs and living specs
```

## Prerequisites

- Node.js >= 20.11
- pnpm 10.x (`corepack enable && corepack prepare pnpm@10.32.1 --activate`)

## Run locally

```sh
pnpm install
cp .env.example .env.local           # then fill in real values
pnpm dev                             # http://localhost:3000
```

## Verification

```sh
pnpm lint        # eslint across the workspace
pnpm typecheck   # tsc --noEmit per package
pnpm test        # vitest (deterministic-PRNG suite, more to come)
pnpm format:check
```

CI runs the same four commands on every PR. Required green before merge.

## Environment variables

Defined in `.env.example`. Copy to `.env.local` and fill in.

| Var                                    | Scope           | Notes                                                                                                                                                                                                |
| -------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | browser+server  | Supabase project URL.                                                                                                                                                                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser+server  | Publishable key (replaces the deprecated `anon key`). RLS-protected, OK to ship.                                                                                                                     |
| `SUPABASE_SERVICE_ROLE_KEY`            | **server only** | Bypasses RLS. Must never reach the browser. Required when code calls `createServiceRoleClient()`; optional at build time until that path exists.                                                     |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`  | browser         | Maps JS SDK only. Must be HTTP-referrer-restricted to our domains in Google Cloud Console.                                                                                                           |
| `GOOGLE_PLACES_SERVER_KEY`             | **server only** | Places API. Used only by `app/api/places/*` route handlers and Edge Functions. IP-restricted.                                                                                                        |
| `NEXT_PUBLIC_SITE_URL`                 | browser+server  | Public URL for Supabase auth redirects. Local: `http://localhost:3000`. On Vercel, if unset, the app uses `https://$VERCEL_URL`; set explicitly for a custom domain so Supabase redirect URLs match. |

`NEXT_PUBLIC_*` vars are inlined into the browser bundle. **Anything without that prefix is server-only.** CI must never echo populated values into logs.

## Conventions

- Server-default rendering. `"use client"` is a leaf-level opt-in.
- Two Supabase factories: `lib/supabase/browser.ts` (publishable) and `lib/supabase/server.ts` (publishable SSR + service-role). Server module is gated by `import "server-only"`.
- Routes live under `app/(marketing)`, `app/(game)`, or `app/(admin)`. Game ↔ admin cross-imports are blocked by ESLint per [ADR-0001 §7](docs/adr/).
- Mobile-first 375×812 baseline. Tokens in `apps/web/app/globals.css` and `apps/web/tailwind.config.ts`.
- Determinism: `packages/sim` is pure. No `Date.now()`, no `Math.random()` — all randomness flows from seeded PRNG (`mulberry32`).
