"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/school";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface TeacherRow {
  id?: string;
  prezime: string;
  ime: string;
  radno_mjesto: string;
}

/** The current school's saved staff roster (ordered by surname). */
export async function getTeachers(): Promise<TeacherRow[]> {
  const school = await getCurrentSchool();
  if (!school) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("teachers")
    .select("id, prezime, ime, radno_mjesto")
    .eq("school_id", school.id)
    .order("prezime", { ascending: true });
  if (error) {
    console.error("getTeachers:", error.message);
    return [];
  }
  return (data ?? []) as TeacherRow[];
}

/**
 * Replace the whole roster for the current school with the confirmed list.
 * The principal reviews/edits the preview before this runs, so a full replace
 * is the right semantic ("this is my current staff"). Scoped to the session's
 * school_id — never a value the client supplies.
 */
export async function saveTeachers(rows: TeacherRow[]): Promise<{ saved: number }> {
  const school = await getCurrentSchool();
  if (!school) throw new Error("Vašem računu nije dodijeljena škola.");

  const clean = rows
    .map((r) => ({
      prezime: String(r.prezime ?? "").trim().slice(0, 120),
      ime: String(r.ime ?? "").trim().slice(0, 120),
      radno_mjesto: String(r.radno_mjesto ?? "").trim().slice(0, 200),
    }))
    .filter((r) => r.prezime || r.ime);

  const supabase = getSupabaseAdmin();
  const { error: delErr } = await supabase.from("teachers").delete().eq("school_id", school.id);
  if (delErr) throw new Error(`Spremanje nije uspjelo: ${delErr.message}`);

  if (clean.length > 0) {
    const { error: insErr } = await supabase
      .from("teachers")
      .insert(clean.map((r) => ({ ...r, school_id: school.id })));
    if (insErr) throw new Error(`Spremanje nije uspjelo: ${insErr.message}`);
  }

  revalidatePath("/ucitelji");
  return { saved: clean.length };
}

/** Remove the whole roster for the current school. */
export async function clearTeachers(): Promise<void> {
  const school = await getCurrentSchool();
  if (!school) return;
  await getSupabaseAdmin().from("teachers").delete().eq("school_id", school.id);
  revalidatePath("/ucitelji");
}
