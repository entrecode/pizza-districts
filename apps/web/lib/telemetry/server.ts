import "server-only";
import {
  consoleTransport,
  createTelemetry,
  httpTransport,
  noopTransport,
  type TelemetryClient,
  type Transport,
} from "@pd/telemetry";

// Server-side telemetry singleton. Used by route handlers, server actions,
// and Edge Functions (via relative import in the function bundle). Carries
// the same qa_canary contract as the browser client — sinks merge canary
// events into the same prod stream and dashboards filter them out by default.

let singleton: TelemetryClient | null = null;

const pickEnv = (vercelEnv: string | undefined): "dev" | "preview" | "prod" => {
  if (vercelEnv === "production") return "prod";
  if (vercelEnv === "preview") return "preview";
  return "dev";
};

const pickTransport = (): Transport => {
  const endpoint = process.env.TELEMETRY_ENDPOINT;
  if (endpoint) return httpTransport({ endpoint, keepalive: false });
  if (process.env.NODE_ENV !== "production") return consoleTransport();
  return noopTransport();
};

export const getServerTelemetry = (): TelemetryClient => {
  if (singleton) return singleton;
  singleton = createTelemetry({
    transport: pickTransport(),
    defaultContext: {
      env: pickEnv(process.env.VERCEL_ENV),
      ...(process.env.VERCEL_GIT_COMMIT_SHA
        ? { build_id: process.env.VERCEL_GIT_COMMIT_SHA }
        : {}),
    },
  });
  return singleton;
};
