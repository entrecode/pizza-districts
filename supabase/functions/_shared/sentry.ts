// Sentry init + capture helper for Supabase Edge Functions (Deno runtime).
// Mirrors apps/web/sentry.{client,server,edge}.config.ts so a single release
// tag covers both Next.js and the Edge function bundle.
//
// Usage in a function:
//
//   import { withSentry } from "../_shared/sentry.ts";
//
//   Deno.serve(withSentry("places-search", async (req) => {
//     // ... handler ...
//   }));
//
// `withSentry` swallows Sentry init errors so a missing DSN never breaks the
// function. PII scrubbing runs on every captured event.

import * as Sentry from "npm:@sentry/deno@^8.55.0";

const REDACTED = "[redacted]";

const PII_KEY_RE =
  /(^|_)(email|password|api[_-]?key|auth(?:orization)?|cookie|set-cookie|session|brand[_-]?seed|seed|supabase[_-]?(?:user|auth))(_|$)/i;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const GOOGLE_API_KEY_RE = /\bAIza[0-9A-Za-z_-]{35}\b/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._\-+/=]+/g;

const redactString = (value: string): string =>
  value
    .replace(GOOGLE_API_KEY_RE, REDACTED)
    .replace(BEARER_RE, `Bearer ${REDACTED}`)
    .replace(EMAIL_RE, REDACTED)
    .replace(UUID_RE, REDACTED);

const scrub = (value: unknown): unknown => {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scrub);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = PII_KEY_RE.test(k) ? REDACTED : scrub(v);
  }
  return out;
};

const release = (): string => {
  const explicit = Deno.env.get("SENTRY_RELEASE");
  if (explicit) return explicit;
  const sha = Deno.env.get("SUPABASE_GIT_COMMIT_SHA") ?? Deno.env.get("VERCEL_GIT_COMMIT_SHA");
  if (sha) return sha.slice(0, 12);
  return "dev";
};

const environment = (): string => {
  return Deno.env.get("SENTRY_ENVIRONMENT") ?? "prod";
};

let inited = false;

export const initSentry = (): void => {
  if (inited) return;
  inited = true;

  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;

  Sentry.init({
    dsn,
    release: release(),
    environment: environment(),
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrub(event) as typeof event;
    },
  });
};

type Handler = (req: Request) => Promise<Response> | Response;

export const withSentry = (name: string, handler: Handler): Handler => {
  initSentry();
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      Sentry.captureException(err, { tags: { fn: name } });
      try {
        await Sentry.flush(2000);
      } catch {
        // intentional: never let telemetry block the error response
      }
      throw err;
    }
  };
};

export const captureEdgeException = (err: unknown, tags?: Record<string, string>): void => {
  initSentry();
  Sentry.captureException(err, tags ? { tags } : undefined);
};

export const __test__ = { redactString, scrub };
