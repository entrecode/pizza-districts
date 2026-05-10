// Browser-side Sentry init. Loaded by @sentry/nextjs on every client page
// load. No-ops cleanly when NEXT_PUBLIC_SENTRY_DSN is unset — that is the
// state in dev and on preview deploys until ops provisions a project DSN.
//
// PII scrubbing runs on every event; see lib/sentry/scrub.ts.

import * as Sentry from "@sentry/nextjs";

import { sentryEnvironment, sentryRelease } from "@/lib/sentry/release";
import { scrubEvent } from "@/lib/sentry/scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    release: sentryRelease(),
    environment: sentryEnvironment(),

    // Error decoding is the goal (Pre-Public-Build Checklist row 16).
    // We deliberately leave performance / replay sampling at zero; row 16
    // does not need them and they add bundle weight + privacy surface.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Default-off for any PII the SDK might collect on its own (request
    // bodies, IPs, user agents). Our beforeSend scrubber catches the rest.
    sendDefaultPii: false,

    beforeSend(event) {
      return scrubEvent(event);
    },
  });
}
