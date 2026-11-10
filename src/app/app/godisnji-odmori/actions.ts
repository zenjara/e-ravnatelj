"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/school";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Kategorija, Rezultati } from "@/lib/ucitelji/godisnji-odmor";
import {
  asKategorija,
  asRezultati,
  cleanSocijalni,
  cleanUvjeti,
  type GoUvjeti,
  type GoSocijalni,
} from "@/lib/ucitelji/go-validation";

/** One saved annual-leave criteria snapshot for a (teacher, year). */
export interface GoSnapshot {
  godina: number;
  kategorija: Kategorija | null;
  go_uvjeti: GoUvjeti;
  go_socijalni: GoSocijalni;
  go_rezultati: Rezultati;
  ukupno_dana: number | null;
  klasa: string;
  urbroj: string;
}

/** Light per-year entry for history chips / counts (no sensitive criteria). */
export interface GoYearEntry {
  teacher_id: string;
  godina: number;
  ukupno_dana: number | null;
}

const asGodina = (v: unknown): number => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : new Date().getFullYear();
};

const SELECT =
  "teacher_id, godina, kategorija, go_uvjeti, go_socijalni, go_rezultati, ukupno_dana, klasa, urbroj";

function toSnapshot(r: Record<string, unknown>): GoSnapshot {
  return {
    godina: Number(r.godina),
    kategorija: asKategorija(r.kategorija),
    go_uvjeti: (r.go_uvjeti ?? {}) as GoUvjeti,
    go_socijalni: (r.go_socijalni ?? {}) as GoSocijalni,
    go_rezultati: asRezultati(r.go_rezultati),
    ukupno_dana: r.ukupno_dana == null ? null : Number(r.ukupno_dana),
    klasa: String(r.klasa ?? ""),
    urbroj: String(r.urbroj ?? ""),
  };
}

/** All saved snapshots for one year, keyed by teacher_id (for the roster + panel init). */
export async function getGoSnapshotsForYear(
  godina: number,
): Promise<Record<string, GoSnapshot>> {
  const school = await getCurrentSchool();
  if (!school) return {};
  const { data, error } = await getSupabaseAdmin()
    .from("teacher_go_years")
    .select(SELECT)
    .eq("school_id", school.id)
    .eq("godina", asGodina(godina));
  if (error) {
    // Table may not exist yet (migration not applied) — fail soft.
    console.error("getGoSnapshotsForYear:", error.message);
    return {};
  }
  const out: Record<string, GoSnapshot> = {};
  for (const r of data ?? []) out[String((r as { teacher_id: string }).teacher_id)] = toSnapshot(r);
  return out;
}

/**
 * The most recent saved snapshot per teacher (latest godina), keyed by
 * teacher_id. Used by the "Učitelji" base to preview the generated Rješenje.
 */
export async function getLatestGoSnapshots(): Promise<Record<string, GoSnapshot>> {
  const school = await getCurrentSchool();
  if (!school) return {};
  const { data, error } = await getSupabaseAdmin()
    .from("teacher_go_years")
    .select(SELECT)
    .eq("school_id", school.id)
    .order("godina", { ascending: false });
  if (error) {
    console.error("getLatestGoSnapshots:", error.message);
    return {};
  }
  const out: Record<string, GoSnapshot> = {};
  // Rows are godina-desc, so the first seen per teacher is the latest.
  for (const r of data ?? []) {
    const tid = String((r as { teacher_id: string }).teacher_id);
    if (!out[tid]) out[tid] = toSnapshot(r);
  }
  return out;
}

/** Light overview of every saved (teacher, year), keyed by teacher_id. For history + counts. */
export async function listGoYears(): Promise<Record<string, GoYearEntry[]>> {
  const school = await getCurrentSchool();
  if (!school) return {};
  const { data, error } = await getSupabaseAdmin()
    .from("teacher_go_years")
    .select("teacher_id, godina, ukupno_dana")
    .eq("school_id", school.id)
    .order("godina", { ascending: false });
  if (error) {
    console.error("listGoYears:", error.message);
    return {};
  }
  const out: Record<string, GoYearEntry[]> = {};
  for (const r of (data ?? []) as GoYearEntry[]) {
    (out[r.teacher_id] ??= []).push({
      teacher_id: r.teacher_id,
      godina: Number(r.godina),
      ukupno_dana: r.ukupno_dana == null ? null : Number(r.ukupno_dana),
    });
  }
  return out;
}

/**
 * Upsert one (teacher, year) annual-leave snapshot. Scoped to the session's
 * school. Also mirrors the criteria onto teachers.go_* as the "latest saved"
 * values, so a brand-new year prefills from the most recent one.
 */
export async function saveGoYear(input: {
  teacherId: string;
  godina: number;
  kategorija: Kategorija;
  uvjeti: GoUvjeti;
  socijalni?: GoSocijalni;
  rezultati?: Rezultati;
  ukupnoDana: number;
  klasa?: string;
  urbroj?: string;
}): Promise<GoSnapshot> {
  const school = await getCurrentSchool();
  if (!school) throw new Error("Vašem računu nije dodijeljena škola.");

  // Guard: the teacher must belong to this school.
  const { data: owns } = await getSupabaseAdmin()
    .from("teachers")
    .select("id")
    .eq("id", input.teacherId)
    .eq("school_id", school.id)
    .maybeSingle();
  if (!owns) throw new Error("Djelatnik ne pripada vašoj školi.");

  const row = {
    school_id: school.id,
    teacher_id: input.teacherId,
    godina: asGodina(input.godina),
    kategorija: asKategorija(input.kategorija) ?? "ostali",
    go_uvjeti: cleanUvjeti(input.uvjeti),
    go_socijalni: cleanSocijalni(input.socijalni),
    go_rezultati: asRezultati(input.rezultati),
    ukupno_dana: Number.isFinite(input.ukupnoDana) ? Math.trunc(input.ukupnoDana) : null,
    klasa: String(input.klasa ?? "").trim().slice(0, 120),
    urbroj: String(input.urbroj ?? "").trim().slice(0, 120),
    updated_at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("teacher_go_years")
    .upsert(row, { onConflict: "teacher_id,godina" })
    .select(SELECT)
    .single();
  if (error) {
    console.error("saveGoYear:", error.message);
    if (/relation .*teacher_go_years.* does not exist|schema cache/i.test(error.message)) {
      throw new Error("Tablica za godišnje odmore još nije kreirana — pokrenite migraciju 0011.");
    }
    throw new Error("Spremanje godine nije uspjelo.");
  }

  // Mirror as "latest" on the teacher row (keeps the base indicator + defaults).
  // Best-effort: the snapshot above is the source of truth, so a failed mirror
  // must not fail the save — but log it so a drifting "latest" is diagnosable
  // instead of silently wrong.
  const { error: mirrorErr } = await supabase
    .from("teachers")
    .update({
      kategorija: row.kategorija,
      go_uvjeti: row.go_uvjeti,
      go_socijalni: row.go_socijalni,
      go_rezultati: row.go_rezultati,
    })
    .eq("id", input.teacherId)
    .eq("school_id", school.id);
  if (mirrorErr) console.error("saveGoYear mirror:", mirrorErr.message);

  revalidatePath("/app/godisnji-odmori");
  return toSnapshot(data as Record<string, unknown>);
}

/** Delete one (teacher, year) snapshot. */
export async function deleteGoYear(teacherId: string, godina: number): Promise<void> {
  const school = await getCurrentSchool();
  if (!school) return;
  await getSupabaseAdmin()
    .from("teacher_go_years")
    .delete()
    .eq("school_id", school.id)
    .eq("teacher_id", teacherId)
    .eq("godina", asGodina(godina));
  revalidatePath("/app/godisnji-odmori");
}
