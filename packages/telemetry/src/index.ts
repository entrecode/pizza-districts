// @pd/telemetry — minimal SDK contract for Pizza Districts.
//
// Every event payload carries a first-class `qa_canary: boolean` (default `false`).
// Prod sinks ingest canary events identically; dashboards/funnels/alerts MUST
// filter `qa_canary = true` out by default. See ADR on PIZ-62.
//
// The SDK is sink-agnostic. Configure a transport (noop / console / http) per
// surface (browser vs server). No transport branches on `qa_canary`.

import { z } from "zod";

// ─── Event shape ────────────────────────────────────────────────

export const EventKindSchema = z.enum(["track", "error", "page_view", "custom"]);
export type EventKind = z.infer<typeof EventKindSchema>;

const PropertiesSchema = z.record(
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
export type EventProperties = z.infer<typeof PropertiesSchema>;

export const TelemetryEventSchema = z.object({
  // Stable identifier per event kind. Examples: "store.opened", "auth.login",
  // "tick.applied", "page.view", "qa.canary".
  name: z.string().min(1),
  kind: EventKindSchema,
  // Synthetic verification flag. QA fires events with qa_canary=true to confirm
  // the prod sink is reachable without polluting business metrics. Dashboards
  // default to filtering qa_canary=true OUT.
  qa_canary: z.boolean().default(false),
  // ISO-8601, UTC. Caller-supplied so server/browser can co-author timestamps.
  ts: z.string().datetime(),
  // Free-form, primitives only. Keep PII out by convention.
  properties: PropertiesSchema.default({}),
  // Optional context. session_id and user_id are scrubbed at the sink boundary
  // for canary events to avoid binding QA pings to real identities.
  context: z
    .object({
      session_id: z.string().optional(),
      user_id: z.string().optional(),
      build_id: z.string().optional(),
      release: z.string().optional(),
      env: z.enum(["dev", "preview", "prod"]).optional(),
    })
    .default({}),
});
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

// ─── Public emit API ────────────────────────────────────────────

export interface EmitInput {
  name: string;
  qa_canary?: boolean;
  properties?: EventProperties;
  context?: TelemetryEvent["context"];
}

export interface ErrorEmitInput extends EmitInput {
  message: string;
  stack?: string;
}

export interface PageViewEmitInput extends EmitInput {
  path: string;
  referrer?: string;
}

// ─── Transport ──────────────────────────────────────────────────

export interface Transport {
  send(event: TelemetryEvent): Promise<void> | void;
}

export const noopTransport = (): Transport => ({
  send() {
    /* no-op */
  },
});

export const consoleTransport = (): Transport => ({
  send(event) {
    // Human-readable for dev; the canary flag is surfaced first.
    console.info(
      `[telemetry${event.qa_canary ? "·canary" : ""}] ${event.kind}/${event.name}`,
      { properties: event.properties, context: event.context, ts: event.ts },
    );
  },
});

export interface HttpTransportOptions {
  endpoint: string;
  // keepalive is critical for unload-time events (page_view on navigation).
  // Browsers cap keepalive bodies at 64KB; events should stay well below.
  keepalive?: boolean;
  // Pluggable for testing / advanced users (e.g. server-side fetch with auth).
  fetchImpl?: typeof fetch;
}

export const httpTransport = (opts: HttpTransportOptions): Transport => {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error(
      "[telemetry] httpTransport requires fetch; pass fetchImpl on non-fetch runtimes",
    );
  }
  return {
    async send(event) {
      await fetchImpl(opts.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
        keepalive: opts.keepalive ?? true,
      });
    },
  };
};

// ─── Client ─────────────────────────────────────────────────────

export interface TelemetryConfig {
  transport: Transport;
  // Default context merged into every event (e.g. release tag, build id).
  defaultContext?: TelemetryEvent["context"];
  // Override clock for tests.
  now?: () => Date;
  // Swallow transport errors so the SDK never crashes the host app.
  // Default: true. Errors bubble to onError if provided.
  swallowErrors?: boolean;
  onError?: (err: unknown, event: TelemetryEvent) => void;
}

export interface TelemetryClient {
  track(input: EmitInput): void;
  error(input: ErrorEmitInput): void;
  pageView(input: PageViewEmitInput): void;
  custom(input: EmitInput): void;
  // QA one-liner: fires a track event with qa_canary=true. Used by row 13
  // of the Pre-Public-Build Checklist on every public-build cycle.
  canaryPing(label?: string): void;
}

export function createTelemetry(config: TelemetryConfig): TelemetryClient {
  const now = config.now ?? (() => new Date());
  const swallow = config.swallowErrors ?? true;

  const emit = (
    kind: EventKind,
    input: EmitInput,
    extraProps: EventProperties = {},
  ): void => {
    const event = TelemetryEventSchema.parse({
      name: input.name,
      kind,
      qa_canary: input.qa_canary ?? false,
      ts: now().toISOString(),
      properties: { ...extraProps, ...(input.properties ?? {}) },
      context: { ...(config.defaultContext ?? {}), ...(input.context ?? {}) },
    });
    try {
      const result = config.transport.send(event);
      if (result instanceof Promise) {
        result.catch((err) => handleError(err, event));
      }
    } catch (err) {
      handleError(err, event);
    }
  };

  const handleError = (err: unknown, event: TelemetryEvent): void => {
    if (config.onError) config.onError(err, event);
    if (!swallow) throw err;
  };

  return {
    track(input) {
      emit("track", input);
    },
    error(input) {
      emit("error", input, {
        message: input.message,
        ...(input.stack ? { stack: input.stack } : {}),
      });
    },
    pageView(input) {
      emit("page_view", input, {
        path: input.path,
        ...(input.referrer ? { referrer: input.referrer } : {}),
      });
    },
    custom(input) {
      emit("custom", input);
    },
    canaryPing(label) {
      emit("track", {
        name: "qa.canary",
        qa_canary: true,
        properties: label ? { label } : {},
      });
    },
  };
}

// ─── Dashboard filter convention ────────────────────────────────
// Every consumer (BI tool, funnel definition, alert rule, retention query)
// MUST apply this predicate by default. A canary-only dashboard inverts it.
//
// Postgres / Supabase:
//   WHERE coalesce((properties ->> 'qa_canary')::boolean, false) = false
// Or, when qa_canary is a top-level column:
//   WHERE qa_canary IS NOT TRUE
//
// Exported here so future dashboard tooling can import and stamp the same
// predicate rather than re-implementing it.
export const CANARY_FILTER_SQL_TOPLEVEL = "qa_canary IS NOT TRUE" as const;
export const CANARY_FILTER_SQL_JSONB =
  "coalesce((properties ->> 'qa_canary')::boolean, false) = false" as const;
