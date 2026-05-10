import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@pd/shared", "@pd/sim"],
};

// Sentry source-map upload + release tagging (PIZ-65).
//
// Wrapper is always applied. With no SENTRY_AUTH_TOKEN / SENTRY_ORG /
// SENTRY_PROJECT set, the plugin is a near no-op: it injects the SDK
// init shims but does not upload maps. CI sets the trio on prod-targeted
// builds; preview/dev builds skip upload.
//
// The release we hand to the plugin MUST equal what the runtime SDK
// reports — both read from the same lib/sentry/release.ts contract via
// SENTRY_RELEASE / VERCEL_GIT_COMMIT_SHA / NEXT_PUBLIC_BUILD_ID.
const release =
  process.env.SENTRY_RELEASE ||
  (process.env.VERCEL_GIT_COMMIT_SHA
    ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12)
    : undefined) ||
  process.env.NEXT_PUBLIC_BUILD_ID ||
  undefined;

export default withSentryConfig(nextConfig, {
  // Auth + project scoping. All three required for upload; absent → no-op.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Release tag for uploaded maps. Plugin will inject the same value into
  // the runtime SDK init via __sentryRelease at build time.
  release: release ? { name: release } : undefined,

  // Suppress the plugin's stdout in CI when the trio is absent; we don't
  // want a noisy "skipping upload" line on every PR build.
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Hide source maps from prod assets (still uploaded to Sentry, just not
  // served alongside the JS). Critical for not leaking original source.
  hideSourceMaps: true,

  // Tunnel client errors through /monitoring to avoid being blocked by
  // ad-blockers in the field. Path is rewritten by the plugin.
  tunnelRoute: "/monitoring",

  // We do not need automatic Vercel cron monitoring.
  automaticVercelMonitors: false,
});
