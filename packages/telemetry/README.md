# @pd/telemetry

Minimal, sink-agnostic telemetry SDK for Pizza Districts. Defines the event
contract used by the web app and Edge Functions. Transports are pluggable.

## Why this exists

Row 13 of the [Pre-Public-Build Checklist](/PIZ/issues/PIZ-54#document-pre-public-build-checklist)
requires a per-cycle prod-sink verification. Doing that with a real event would
pollute KPI dashboards, funnels, and alerts. The contract solves it cleanly: a
first-class `qa_canary: boolean` on every event payload, with a documented
default-exclude filter on every consumer.

See ADR on [PIZ-62](/PIZ/issues/PIZ-62#document-adr).

## Event contract

Every event carries `qa_canary` (default `false`). The shape is identical for
all four kinds — `track`, `error`, `page_view`, `custom`. Transports never
branch on `qa_canary`; canary events go to the **same prod sink** as normal
events.

```ts
import { createTelemetry, httpTransport } from "@pd/telemetry";

const telemetry = createTelemetry({
  transport: httpTransport({ endpoint: "/api/telemetry" }),
  defaultContext: { release: "v0.1.0", env: "prod" },
});

telemetry.track({ name: "store.opened" }); // qa_canary defaults to false
telemetry.error({ name: "places.proxy.failed", message: "upstream 502" });
telemetry.pageView({ name: "page.view", path: "/dashboard" });
telemetry.custom({ name: "tick.applied", properties: { tickNo: 42 } });
```

## QA one-liner (Pre-Public-Build Checklist row 13)

In the browser console of a public-build artifact:

```js
window.__pdTelemetry.canaryPing("cycle-2026-W19");
```

This fires a `track` event with `name="qa.canary"`, `qa_canary=true`, and a
`label` property. QA verifies:

1. The event lands in the **raw prod sink** (canary-only dashboard / saved
   query, see below).
2. The event does **not** appear in any non-canary dashboard, funnel, retention
   query, or alert.

Both must be true for row 13 to go green.

## Mandatory dashboard filter convention

Every BI tool, funnel definition, alert rule, retention query, or cohort
analysis MUST default-exclude canary events. The SDK exports the canonical
predicates so consumers stamp the same string:

```ts
import {
  CANARY_FILTER_SQL_JSONB,
  CANARY_FILTER_SQL_TOPLEVEL,
} from "@pd/telemetry";
```

- `qa_canary IS NOT TRUE` — when stored as a top-level column.
- `coalesce((properties ->> 'qa_canary')::boolean, false) = false` — when
  stored as JSONB properties.

Inverted predicates (`qa_canary IS TRUE`) are reserved for the canary-only
dashboard QA uses to verify row 13.

## Transports

- `noopTransport()` — silent. Default for tests and SSR contexts where no
  sink is wired yet.
- `consoleTransport()` — pretty-prints to `console.info` for dev visibility.
  Canary events render with a `·canary` tag.
- `httpTransport({ endpoint, keepalive?, fetchImpl? })` — POSTs JSON to a
  configured endpoint. `keepalive: true` by default so unload-time events
  (e.g. `page_view` on navigation) survive.

The SDK swallows transport errors by default (`swallowErrors: true`) and
forwards them to an optional `onError` callback so telemetry never crashes
the host app. Tests can opt out (`swallowErrors: false`).

## Out of scope (today)

- Net-new dashboards beyond the canary-only one.
- Backfilling `qa_canary=false` on historical rows. The default is fine going
  forward.
- Concrete sink choice (Supabase table vs. Sentry vs. PostHog). When that
  decision lands, configure the transport at the app boundary; the contract
  in this package does not change.
