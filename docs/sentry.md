# Crash reporting (Sentry) — operator guide

Wires the [Pre-Public-Build Checklist row 16](/PIZ/issues/PIZ-54#document-pre-public-build-checklist)
gate. Source files: `apps/web/sentry.{client,server,edge}.config.ts`,
`apps/web/instrumentation.ts`, `apps/web/lib/sentry/`,
`supabase/functions/_shared/sentry.ts`, `apps/web/next.config.mjs` (the
`withSentryConfig` wrapper). Decision is recorded in ADR-0005 on PIZ-65.

## Provisioning checklist

When ops creates the Sentry project, set these and nothing more:

| Variable                    | Where                              | Notes                                                     |
| --------------------------- | ---------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN`    | Vercel + GitHub Actions secrets    | Browser DSN, exposed in client bundle.                    |
| `SENTRY_DSN`                | Vercel + GitHub Actions secrets    | Server-side DSN. Usually equal to the public DSN.         |
| `SENTRY_AUTH_TOKEN`         | GitHub Actions secret only         | Build-time source-map upload. Never expose to runtime.    |
| `SENTRY_ORG`                | GitHub Actions repo variable       | e.g. `pizza-districts`.                                   |
| `SENTRY_PROJECT`            | GitHub Actions repo variable       | e.g. `web`.                                               |
| `SENTRY_RELEASE` (optional) | CI step only                       | Defaults to `github.sha` in the build-with-sentry job.    |
| `SENTRY_SMOKE_TOKEN`        | Vercel prod env (rotate per cycle) | Required to fire `/api/sentry-smoke` against prod builds. |

The `withSentryConfig` plugin is a no-op when `SENTRY_AUTH_TOKEN` /
`SENTRY_ORG` / `SENTRY_PROJECT` are absent — PRs from forks and dev builds
build fine without these values.

## Release identifier convention

The runtime SDK and the build-time map upload MUST agree on the release
string. We resolve it the same way in both places (see
`apps/web/lib/sentry/release.ts`):

1. `SENTRY_RELEASE` if explicitly set.
2. `VERCEL_GIT_COMMIT_SHA` (12-char short SHA) on Vercel.
3. `NEXT_PUBLIC_BUILD_ID` for ad-hoc builds.
4. `"dev"` sentinel — local dev / unconfigured envs. Source maps are NOT
   uploaded for `dev`.

CI sets `SENTRY_RELEASE: ${{ github.sha }}` on the `build-with-sentry` job
so the release matches the GitHub commit page exactly.

## PII / secret scrubbing

`apps/web/lib/sentry/scrub.ts` (Next.js) and the inline scrubber in
`supabase/functions/_shared/sentry.ts` (Edge Functions) walk every event
payload and redact:

- Email addresses (`[\w.+-]+@[\w-]+\.[\w.-]+`)
- UUIDs (Supabase user ids)
- Google API keys (`AIza[0-9A-Za-z_-]{35}` — Maps + Places)
- `Bearer …` tokens
- Any object key matching email / password / api[_-]?key / authorization /
  cookie / set-cookie / session / supabase[_-]?(user|auth) /
  brand[_-]?seed / seed

Both scrubbers default to `sendDefaultPii: false` so the SDK itself never
collects request bodies or IPs. The PII filter is the second line.

If a future event needs to carry a user identifier deliberately, attach it
via `Sentry.setUser({ id: anonHash })` AFTER hashing, and document the call
site here so the scrubber's regex list can be reviewed.

## Smoke test (Pre-Public-Build Checklist row 16 evidence)

Two affordances. Pick one per cycle and capture the resulting Sentry event
URL with decoded frames as the row 16 artifact.

### Server route (preferred — exercises server SDK + source maps)

In a build with `SENTRY_SMOKE_TOKEN` set:

```sh
curl -i -H "Authorization: Bearer $SENTRY_SMOKE_TOKEN" \
  "https://<host>/api/sentry-smoke?kind=throw"
```

Expected: HTTP 500 from the route and a Sentry event tagged `sentry_smoke`
(`throw` or `reject`). The handler calls `captureException` + `flush` so
delivery does not rely on Next.js invoking `onRequestError` for route handlers
(see [PIZ-77](/PIZ/issues/PIZ-77)). The event should use the deploy release
and decoded frames should point at `apps/web/app/api/sentry-smoke/route.ts`.

For preview/dev builds without a token, set
`NEXT_PUBLIC_SENTRY_SMOKE_ENABLED=1` to allow unauthenticated smoke fires.
This flag is ignored when `VERCEL_ENV=production`.

### Browser console (alternate — exercises client init)

On a public build with the SDK active:

```js
throw new Error("piz-65 smoke: client " + new Date().toISOString());
```

Sentry should capture the unhandled error. Decoded frames should resolve
to the original TS file the throw came from.

## Out of scope

- Performance / RUM / replay sampling (kept at 0).
- Alerting rules and on-call routing.
- Backfill of historical errors.
