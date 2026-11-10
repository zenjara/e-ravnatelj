"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/school";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  procijeniKategoriju,
  type Kategorija,
  type Rezultati,
} from "@/lib/ucitelji/godisnji-odmor";
import {
  asKategorija,
  asRezultati,
  cleanSocijalni,
  cleanUvjeti,
  type GoSocijalni,
  type GoUvjeti,
} from "@/lib/ucitelji/go-validation";

// Re-exported so existing importers (client components, godisnji-odmori) keep
// their `from "../ucitelji/actions"` paths working after the dedup.
export type { GoUvjeti, GoSocijalni } from "@/lib/ucitelji/go-validation";

export interface TeacherRow {
  id?: string;
  prezime: string;
  ime: string;
  radno_mjesto: string;
  staz_ukupno?: number | null;
  staz_obrazovni?: number | null;
  kategorija?: Kategorija | null;
  go_uvjeti?: GoUvjeti;
  go_socijalni?: GoSocijalni;
  go_rezultati?: Rezultati;
}

/** The current school's saved staff roster (ordered by surname). */
export async function getTeachers(): Promise<TeacherRow[]> {
  const school = await getCurrentSchool();
  if (!school) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("teachers")
    .select("id, prezime, ime, radno_mjesto, staz_ukupno, staz_obrazovni, kategorija, go_uvjeti, go_socijalni, go_rezultati")
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
 *
 * Note: re-importing resets per-employee GO tweaks (kategorija/uvjeti), since
 * it rebuilds the roster from the file. Složenost is re-guessed from zvanje.
 */
export async function saveTeachers(
  rows: TeacherRow[],
): Promise<{ saved: number; teachers: TeacherRow[] }> {
  const school = await getCurrentSchool();
  if (!school) throw new Error("Vašem računu nije dodijeljena škola.");

  const clean = rows
    .map((r) => {
      const radno_mjesto = String(r.radno_mjesto ?? "").trim().slice(0, 200);
      return {
        prezime: String(r.prezime ?? "").trim().slice(0, 120),
        ime: String(r.ime ?? "").trim().slice(0, 120),
        radno_mjesto,
        staz_ukupno: Number.isFinite(r.staz_ukupno as number) ? Math.trunc(r.staz_ukupno as number) : null,
        staz_obrazovni: Number.isFinite(r.staz_obrazovni as number) ? Math.trunc(r.staz_obrazovni as number) : null,
        kategorija: asKategorija(r.kategorija) ?? procijeniKategoriju(radno_mjesto),
      };
    })
    .filter((r) => r.prezime || r.ime);

  const supabase = getSupabaseAdmin();
  const { error: delErr } = await supabase.from("teachers").delete().eq("school_id", school.id);
  if (delErr) throw new Error(`Spremanje nije uspjelo: ${delErr.message}`);

  let saved: TeacherRow[] = [];
  if (clean.length > 0) {
    // Return the inserted rows WITH their generated ids so the client can edit
    // GO criteria / zvanje immediately, without a page reload.
    const { data, error: insErr } = await supabase
      .from("teachers")
      .insert(clean.map((r) => ({ ...r, school_id: school.id })))
      .select("id, prezime, ime, radno_mjesto, staz_ukupno, staz_obrazovni, kategorija, go_uvjeti, go_socijalni, go_rezultati");
    if (insErr) throw new Error(`Spremanje nije uspjelo: ${insErr.message}`);
    saved = ((data ?? []) as TeacherRow[]).sort((a, b) =>
      a.prezime.localeCompare(b.prezime, "hr"),
    );
  }

  revalidatePath("/app/ucitelji");
  return { saved: saved.length, teachers: saved };
}

/**
 * Save one employee's full GO criteria (složenost + uvjeti rada + socijalni +
 * radni rezultati) without re-uploading the roster. Social criteria are
 * sensitive: stored server-side only, scoped to the school, never sent to the AI.
 */
export async function updateTeacherGo(
  id: string,
  kategorija: Kategorija,
  goUvjeti: GoUvjeti,
  socijalni?: GoSocijalni,
  rezultati?: Rezultati,
): Promise<void> {
  const school = await getCurrentSchool();
  if (!school) throw new Error("Vašem računu nije dodijeljena škola.");

  const kat = asKategorija(kategorija) ?? "ostali";

  const { error } = await getSupabaseAdmin()
    .from("teachers")
    .update({
      kategorija: kat,
      go_uvjeti: cleanUvjeti(goUvjeti),
      go_socijalni: cleanSocijalni(socijalni),
      go_rezultati: asRezultati(rezultati),
    })
    .eq("id", id)
    .eq("school_id", school.id); // scope: can't touch another school's row
  if (error) {
    console.error("updateTeacherGo:", error.message);
    throw new Error("Spremanje kriterija nije uspjelo.");
  }
  revalidatePath("/app/ucitelji");
}

/**
 * Update one employee's zvanje (role) on the saved roster, and re-derive the
 * suggested složenost from it. Real e-Matica exports often leave zvanje empty,
 * so the principal fills it here without re-importing. Scoped to the school.
 * Returns the newly suggested kategorija so the client can refresh.
 */
export async function updateTeacherZvanje(
  id: string,
  zvanje: string,
): Promise<{ kategorija: Kategorija }> {
  const school = await getCurrentSchool();
  if (!school) throw new Error("Vašem računu nije dodijeljena škola.");

  const radno_mjesto = String(zvanje ?? "").trim().slice(0, 200);
  const kategorija = procijeniKategoriju(radno_mjesto);

  const { error } = await getSupabaseAdmin()
    .from("teachers")
    .update({ radno_mjesto, kategorija })
    .eq("id", id)
    .eq("school_id", school.id);
  if (error) {
    console.error("updateTeacherZvanje:", error.message);
    throw new Error("Spremanje zvanja nije uspjelo.");
  }
  revalidatePath("/app/ucitelji");
  return { kategorija };
}

/** Remove the whole roster for the current school. */
export async function clearTeachers(): Promise<void> {
  const school = await getCurrentSchool();
  if (!school) return;
  await getSupabaseAdmin().from("teachers").delete().eq("school_id", school.id);
  revalidatePath("/app/ucitelji");
}
