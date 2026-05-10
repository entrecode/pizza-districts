// Edge-runtime Sentry init for Next.js (middleware + edge route handlers).
// Note: Supabase Edge Functions are NOT this runtime — those live under
// supabase/functions/ and use supabase/functions/_shared/sentry.ts.

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
