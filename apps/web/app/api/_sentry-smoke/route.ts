import { NextResponse } from "next/server";

// Smoke-test affordance for Pre-Public-Build Checklist row 16.
//
// QA fires this route on a real public build to deliberately throw a server
// error. Sentry captures it via the instrumentation onRequestError hook;
// row 16 is green when the resulting Sentry event shows decoded frames that
// map back to this file (TS source, not the bundled .next/server output).
//
// Path is intentionally underscore-prefixed to keep it out of marketing
// crawls. It is also gated by:
//   1. Bearer token equal to SENTRY_SMOKE_TOKEN, OR
//   2. NEXT_PUBLIC_SENTRY_SMOKE_ENABLED === "1" in non-prod environments.
// In prod (VERCEL_ENV=production), the token is required — never the flag.
//
// QA one-liners:
//   curl -H "Authorization: Bearer $TOKEN" https://<host>/api/_sentry-smoke?kind=throw
//   curl -H "Authorization: Bearer $TOKEN" https://<host>/api/_sentry-smoke?kind=reject
//
// Browser console (when SENTRY_SMOKE_ENABLED=1 in dev/preview):
//   await fetch("/api/_sentry-smoke?kind=throw")

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

export function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse("not found", { status: 404 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "throw";

  if (kind === "reject") {
    // Async path — exercises the unhandled-rejection capture.
    return Promise.reject(
      new Error(`piz-65 smoke: rejected promise at ${new Date().toISOString()}`),
    );
  }

  // Sync path — exercises the route-handler exception capture.
  throw new Error(`piz-65 smoke: thrown error at ${new Date().toISOString()}`);
}
