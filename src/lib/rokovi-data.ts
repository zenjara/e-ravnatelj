import "server-only";
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Rok } from "@/lib/rokovnik";

/**
 * Load the global deadline registry (same for every school). Read-only, no PII.
 * Returns [] gracefully if the table isn't there yet. Memoized per request.
 */
export const getRokovi = cache(async (): Promise<Rok[]> => {
  const { data, error } = await getSupabaseAdmin()
    .from("rokovi")
    .select("slug, naziv, kategorija, md, rule, osnova, checklist, reminder_days, provjeriti")
    .eq("aktivan", true)
    .order("sort", { ascending: true });
  if (error) {
    console.error("getRokovi:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    slug: r.slug,
    naziv: r.naziv,
    kategorija: r.kategorija,
    md: r.md,
    rule: (r.rule === "yearly" ? "yearly" : "fixed") as Rok["rule"],
    osnova: r.osnova,
    checklist: Array.isArray(r.checklist) ? (r.checklist as string[]) : [],
    reminder_days: r.reminder_days ?? 14,
    provjeriti: !!r.provjeriti,
  }));
});
