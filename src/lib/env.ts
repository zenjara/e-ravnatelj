/**
 * Centralized, typed access to environment variables.
 *
 * Server secrets are read lazily via `requireServerEnv(...)` so that a missing
 * value throws a clear error at the point of use (e.g. inside an API route)
 * rather than crashing the whole app at import time. This lets us build the
 * project feature-by-feature without every page needing every secret set.
 *
 * NOTE: Only `NEXT_PUBLIC_*` vars are safe to read in client components.
 * Everything else here must only be imported from server-side code.
 */

/** Server-only env var names. */
type ServerEnvKey =
  | "GEMINI_API_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SESSION_SECRET";

/**
 * Read a required server-side environment variable.
 * Throws a descriptive error if it is missing or empty.
 */
export function requireServerEnv(key: ServerEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}

/**
 * Public env (safe in the browser). These are inlined at build time by Next.js,
 * so they must be referenced by their full literal name.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
} as const;
