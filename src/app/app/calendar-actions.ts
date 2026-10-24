"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SchoolDate } from "@/lib/school-calendar";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Load the current school's own calendar dates (for the logged-in principal). */
export async function getSchoolDates(): Promise<SchoolDate[]> {
  const session = await requireSession();
  const { data, error } = await getSupabaseAdmin()
    .from("school_dates")
    .select("id, d, label")
    .eq("user_id", session.uid)
    .order("d", { ascending: true });
  if (error) {
    console.error("getSchoolDates:", error.message);
    return [];
  }
  return (data ?? []) as SchoolDate[];
}

/**
 * Add (or update the label of) one school-entered date. Bound to the add form.
 * Scoped to the current principal via user_id; `upsert` keeps one row per day.
 */
export async function addSchoolDate(formData: FormData): Promise<void> {
  const session = await requireSession();
  const d = String(formData.get("d") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim().slice(0, 120);
  if (!ISO_RE.test(d) || !label) return;

  const { error } = await getSupabaseAdmin()
    .from("school_dates")
    .upsert({ user_id: session.uid, d, label }, { onConflict: "user_id,d" });
  if (error) {
    console.error("addSchoolDate:", error.message);
    throw new Error("Spremanje datuma nije uspjelo.");
  }
  revalidatePath("/app");
}

/** Remove one school-entered date — only if it belongs to the current principal. */
export async function removeSchoolDate(id: string): Promise<void> {
  const session = await requireSession();
  const { error } = await getSupabaseAdmin()
    .from("school_dates")
    .delete()
    .eq("id", id)
    .eq("user_id", session.uid);
  if (error) {
    console.error("removeSchoolDate:", error.message);
    throw new Error("Brisanje datuma nije uspjelo.");
  }
  revalidatePath("/app");
}
