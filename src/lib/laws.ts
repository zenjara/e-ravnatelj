import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Laws are stored in the `laws` table (authoritative, editable at runtime).
 * The reader and the RAG ingestion both read from here; the .txt files in
 * src/content/laws/ are only the initial seed.
 */

export interface LawMeta {
  slug: string;
  title: string;
  kind: string;
}

/** URL slug for a law, derived from its title/source name. */
export function slugify(s: string): string {
  return s
    .normalize("NFD") // decomposes č/ć/š/ž into base letter + combining mark
    .replace(/\p{Diacritic}/gu, "") // remove the combining marks
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** All laws, sorted by title. */
export async function listLaws(): Promise<LawMeta[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("laws")
    .select("slug, title, kind")
    .order("title");
  if (error) throw new Error(`listLaws failed: ${error.message}`);
  return (data ?? []).sort((a, b) => a.title.localeCompare(b.title, "hr"));
}

/** Full current text + title for one law, or null if the slug is unknown. */
export async function getLaw(
  slug: string,
): Promise<{ title: string; text: string } | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("laws")
    .select("title, current_text")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getLaw failed: ${error.message}`);
  if (!data) return null;
  return { title: data.title, text: data.current_text };
}
