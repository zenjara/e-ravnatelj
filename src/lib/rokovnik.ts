import { daysBetween, fmtHr } from "@/lib/school-calendar";

/**
 * Rokovnik helpers — pure, framework-agnostic. Global deadlines recur annually on
 * a fixed MM-DD; the concrete upcoming date is the next occurrence from today.
 */

export interface Rok {
  slug: string;
  naziv: string;
  kategorija: string;
  md: string; // "MM-DD"
  rule: "fixed" | "yearly";
  osnova: string | null;
  checklist: string[];
  reminder_days: number;
  provjeriti: boolean;
}

export interface UpcomingRok {
  slug: string;
  naziv: string;
  kategorija: string;
  osnova: string | null;
  checklist: string[];
  reminder_days: number;
  provjeriti: boolean;
  dateIso: string;
  dateHr: string;
  daysUntil: number;
  /** True when the deadline falls within its reminder window. */
  soon: boolean;
}

/** Next calendar occurrence of a MM-DD, relative to `todayIso` (today if still ahead). */
export function nextOccurrence(md: string, todayIso: string): string {
  const year = Number(todayIso.slice(0, 4));
  const candidate = `${year}-${md}`;
  return candidate >= todayIso ? candidate : `${year + 1}-${md}`;
}

/** Humanized countdown for a deadline. */
export function rokRelative(daysUntil: number): string {
  if (daysUntil <= 0) return "danas";
  if (daysUntil === 1) return "sutra";
  return `za ${daysUntil} dana`;
}

/** Soonest deadlines from today, with computed date + countdown. */
export function upcomingRokovi(
  rokovi: Rok[],
  todayIso: string,
  limit = 5,
): UpcomingRok[] {
  return rokovi
    .map((r) => {
      const dateIso = nextOccurrence(r.md, todayIso);
      const daysUntil = daysBetween(todayIso, dateIso);
      return {
        slug: r.slug,
        naziv: r.naziv,
        kategorija: r.kategorija,
        osnova: r.osnova,
        checklist: r.checklist,
        reminder_days: r.reminder_days,
        provjeriti: r.provjeriti,
        dateIso,
        dateHr: fmtHr(dateIso),
        daysUntil,
        soon: daysUntil <= r.reminder_days,
      };
    })
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso))
    .slice(0, limit);
}
