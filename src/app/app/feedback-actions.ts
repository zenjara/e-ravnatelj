"use server";

import { requireSession } from "@/lib/session";
import { getCurrentSchool } from "@/lib/school";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const KATEGORIJE = new Set(["prijedlog", "greška", "pitanje", "ostalo"]);

/**
 * Store one piece of beta feedback. Scoped to the logged-in principal; the
 * school is resolved server-side (users.school_id), never trusted from input.
 * Returns {ok} so the widget can show a thank-you without a page reload.
 */
export async function submitFeedback(
  formData: FormData,
): Promise<{ ok: boolean }> {
  const session = await requireSession();

  const poruka = String(formData.get("poruka") ?? "").trim().slice(0, 4000);
  if (!poruka) return { ok: false };

  let kategorija = String(formData.get("kategorija") ?? "prijedlog").trim();
  if (!KATEGORIJE.has(kategorija)) kategorija = "ostalo";

  const stranica =
    String(formData.get("stranica") ?? "").trim().slice(0, 200) || null;

  const school = await getCurrentSchool();

  const { error } = await getSupabaseAdmin().from("feedback").insert({
    user_id: session.uid,
    school_id: school?.id ?? null,
    username: session.usr || null,
    school: session.school || null,
    kategorija,
    poruka,
    stranica,
  });

  if (error) {
    console.error("submitFeedback:", error.message);
    return { ok: false };
  }
  return { ok: true };
}
