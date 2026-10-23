import "server-only";
import { cache } from "react";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface CurrentSchool {
  id: string;
  naziv: string;
  mjesto: string | null;
  zupanija: string | null;
}

/**
 * The school the current principal is bound to (users.school_id → schools).
 * Server-authoritative: the binding is set by the admin at account creation,
 * never chosen by the user. Returns null when no school is assigned yet.
 * Memoized per request.
 */
export const getCurrentSchool = cache(async (): Promise<CurrentSchool | null> => {
  const session = await requireSession();
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("school:school_id (id, naziv, mjesto, zupanija)")
    .eq("id", session.uid)
    .maybeSingle();
  if (error || !data?.school) return null;
  // The embedded resource is returned as an object (or array on some clients).
  const s = Array.isArray(data.school) ? data.school[0] : data.school;
  return s ? (s as CurrentSchool) : null;
});
