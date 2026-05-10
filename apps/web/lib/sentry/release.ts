// Release identifier used by every Sentry SDK init in this app and by the
// build-time source-map upload. Must resolve to the same string in both
// places — that is what lets uploaded maps decode runtime stack traces.
//
// Convention (PIZ-65):
//   1. SENTRY_RELEASE if explicitly set (build pipeline can pin a semver tag).
//   2. VERCEL_GIT_COMMIT_SHA on Vercel deploys (12-char short SHA).
//   3. NEXT_PUBLIC_BUILD_ID for ad-hoc builds outside Vercel.
//   4. "dev" sentinel — local dev / unconfigured envs.
//
// Anything that isn't (1)/(2)/(3) sets release="dev" and Sentry treats it as
// an untagged release. Source maps are NOT uploaded for "dev".

export const sentryRelease = (): string => {
  const explicit = process.env.SENTRY_RELEASE;
  if (explicit && explicit.length > 0) return explicit;

  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha && vercelSha.length > 0) return vercelSha.slice(0, 12);

  const buildId = process.env.NEXT_PUBLIC_BUILD_ID;
  if (buildId && buildId.length > 0) return buildId;

  return "dev";
};

export const sentryEnvironment = (): string => {
  const env = process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV;
  if (env === "production") return "prod";
  if (env === "preview") return "preview";
  return "dev";
};
