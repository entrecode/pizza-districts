import "server-only";
import { z } from "zod";
import { clientEnv } from "./client";

// Server env. Includes secrets that must never reach the browser.
// `import "server-only"` makes a client import a build error.
const ServerEnv = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_PLACES_SERVER_KEY: z.string().min(1).optional(),
});

const parsed = ServerEnv.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  GOOGLE_PLACES_SERVER_KEY: process.env.GOOGLE_PLACES_SERVER_KEY,
});

export const env = { ...clientEnv, ...parsed };

// Factory form, matches the pattern used in route handlers and middleware.
// Returns the same parsed env object — kept for naming symmetry with browserEnv-style call sites.
export function serverEnv() {
  return env;
}
