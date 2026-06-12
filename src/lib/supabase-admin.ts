import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, requireServerEnv } from "@/lib/env";

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 *
 * This bypasses Row Level Security, so it must NEVER be imported into client
 * code. The `server-only` import above makes the build fail if it ever is.
 *
 * Created lazily so a missing env var throws at call time (with a clear
 * message) rather than at module import.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = publicEnv.supabaseUrl;
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local (see .env.example).",
    );
  }
  const serviceRoleKey = requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
