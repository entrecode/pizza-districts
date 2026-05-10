/**
 * Public site origin for auth redirects and absolute URLs.
 * On Vercel, `VERCEL_URL` is always set during build and runtime; use it when
 * `NEXT_PUBLIC_SITE_URL` was not copied into the project env (common footgun).
 */
export function resolvePublicSiteUrl(env: NodeJS.ProcessEnv): string | undefined {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit;
  const vercel = env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return undefined;
}
