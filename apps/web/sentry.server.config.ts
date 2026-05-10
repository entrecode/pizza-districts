// Node-runtime Sentry init for Next.js server (route handlers, server
// actions, server components). Mirrors sentry.client.config.ts but reads the
// non-public DSN env (SENTRY_DSN). No-op when DSN is unset.

import * as Sentry from "@sentry/nextjs";

import { sentryEnvironment, sentryRelease } from "@/lib/sentry/release";
import { scrubEvent } from "@/lib/sentry/scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    release: sentryRelease(),
    environment: sentryEnvironment(),

    tracesSampleRate: 0,
    sendDefaultPii: false,

    beforeSend(event) {
      return scrubEvent(event);
    },
  });
}
