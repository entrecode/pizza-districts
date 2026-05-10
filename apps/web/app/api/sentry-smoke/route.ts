import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

// Smoke-test affordance for Pre-Public-Build Checklist row 16.
//
// QA hits this route on a real public build to force a server-side error
// that is reported to Sentry. We call Sentry.captureException + flush here
// on purpose: on Vercel serverless the isolate can exit before the SDK
// finishes sending when relying only on instrumentation onRequestError; and
// Next 15 + Sentry OTel can skip that hook for some App Router handler paths
// (PIZ-77). Row 16 is green when the Sentry event shows decoded frames
// mapping to this file (TS source, not only bundled .next/server output).
//
// Privacy:
//   - Auth-gated: Bearer token equal to SENTRY_SMOKE_TOKEN (required in prod),
//     OR NEXT_PUBLIC_SENTRY_SMOKE_ENABLED === "1" in non-prod environments.
//   - `<meta name="robots" content="noindex">` is applied at app level; this
//     route also returns 404 to anonymous callers so it leaks no signal.
//   - NOTE: an earlier version sat at `/api/_sentry-smoke`. Next.js treats
//     directories prefixed with `_` as PRIVATE folders and excludes them from
//     routing, so the route never deployed. Path is now `/api/sentry-smoke`.
//
// QA one-liners:
//   curl -H "Authorization: Bearer $TOKEN" https://<host>/api/sentry-smoke?kind=throw
//   curl -H "Authorization: Bearer $TOKEN" https://<host>/api/sentry-smoke?kind=reject
//
// Browser console (when SENTRY_SMOKE_ENABLED=1 in dev/preview):
//   await fetch("/api/sentry-smoke?kind=throw")

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isProd = (): boolean => process.env.VERCEL_ENV === "production";

const isAuthorized = (request: Request): boolean => {
  const token = process.env.SENTRY_SMOKE_TOKEN;
  if (token) {
    const header = request.headers.get("authorization") ?? "";
    if (header === `Bearer ${token}`) return true;
  }
  if (!isProd() && process.env.NEXT_PUBLIC_SENTRY_SMOKE_ENABLED === "1") return true;
  return false;
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse("not found", { status: 404 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "throw";

  if (kind === "reject") {
    const err = new Error(`piz-65 smoke: rejected promise at ${new Date().toISOString()}`);
    Sentry.captureException(err, { tags: { sentry_smoke: "reject" } });
    await Sentry.flush(2000);
    return Promise.reject(err);
  }

  const err = new Error(`piz-65 smoke: thrown error at ${new Date().toISOString()}`);
  Sentry.captureException(err, { tags: { sentry_smoke: "throw" } });
  await Sentry.flush(2000);
  throw err;
}
