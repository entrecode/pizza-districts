"use client";

import {
  consoleTransport,
  createTelemetry,
  httpTransport,
  noopTransport,
  type TelemetryClient,
  type Transport,
} from "@pd/telemetry";

import { clientEnv } from "@/lib/env/client";

// Singleton browser client. Mounted at app boot via <TelemetryBoot/>.
// Server-side imports MUST go through lib/telemetry/server.ts instead — this
// file is "use client" and would be tree-shaken on the server anyway.

let singleton: TelemetryClient | null = null;

const pickTransport = (): Transport => {
  // Endpoint is opt-in via NEXT_PUBLIC_TELEMETRY_ENDPOINT. When unset, browser
  // telemetry no-ops in prod and console-logs in dev. The canary contract is
  // unaffected — when an endpoint lands, the same call site emits canary
  // events to the same prod sink as normal events.
  const endpoint = process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT;
  if (endpoint) return httpTransport({ endpoint, keepalive: true });
  if (process.env.NODE_ENV !== "production") return consoleTransport();
  return noopTransport();
};

export const getBrowserTelemetry = (): TelemetryClient => {
  if (singleton) return singleton;
  singleton = createTelemetry({
    transport: pickTransport(),
    defaultContext: {
      env:
        process.env.NODE_ENV === "production"
          ? clientEnv.NEXT_PUBLIC_SITE_URL.includes("localhost")
            ? "dev"
            : "prod"
          : "dev",
      ...(process.env.NEXT_PUBLIC_BUILD_ID
        ? { build_id: process.env.NEXT_PUBLIC_BUILD_ID }
        : {}),
      ...(process.env.NEXT_PUBLIC_RELEASE
        ? { release: process.env.NEXT_PUBLIC_RELEASE }
        : {}),
    },
    onError: (err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[telemetry] transport error (swallowed):", err);
      }
    },
  });
  return singleton;
};
