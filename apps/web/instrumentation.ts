// Next.js 15 instrumentation hook. Loads the right Sentry runtime config
// based on the Next runtime that called us. @sentry/nextjs will fall back to
// the legacy sentry.{server,edge}.config.ts files when this hook delegates,
// which keeps both routing patterns working.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
