/**
 * School-calendar data + helpers — pure and framework-agnostic.
 *
 * Safe to import from BOTH Server Components and Client Components: it has no
 * `server-only` / `next` imports and touches no request state. The fixed yearly
 * framework (nastavni dani, odmori, državni blagdani) lives here; the dates a
 * school enters itself (Dan škole, Dan grada…) come from the DB and are passed
 * in as `SchoolDate[]`.
 *
 * NOTE: the 2026./2027. values below are placeholders based on the usual
 * structure. When the Ministry publishes "Odluka o početku i završetku nastavne
 * godine" for 2026./2027., swap the constants in `SCHOOL_YEAR` — nothing else
 * needs to change.
 */

export type DayType =
  | "nastava" // regular teaching day
  | "odmor" // pupils' break (zimski/proljetni/ljetni)
  | "blagdan" // national holiday / non-working day
  | "vikend" // weekend
  | "skola" // school-entered day (Dan škole / grada / općine, nenastavni radni dan)
  | "nenastava"; // working day outside the teaching period

/** A date the school enters itself (stored in `school_dates`). */
export interface SchoolDate {
  id?: string;
  d: string; // ISO yyyy-mm-dd
  label: string;
}

/** One national-exam sitting (NCVVO). Exam days are regular teaching days. */
export interface ExamDay {
  razred: 4 | 8;
  predmet: string;
  vrijeme: string; // "9:00"
}

export interface YearConfig {
  label: string; // "2026./2027."
  nnRef: string; // reference to the Ministry decision (placeholder)
  nastavaStart: string;
  nastavaEnd: string;
  firstHalf: [string, string]; // I. polugodište [od, do]
  secondHalf: [string, string]; // II. polugodište [od, do]
  odmori: { ime: string; from: string; to: string }[];
  blagdani: Record<string, string>;
  /** National exams (NCVVO) by date. These days stay regular teaching days. */
  ispiti: Record<string, ExamDay[]>;
}

export const SCHOOL_YEAR: YearConfig = {
  label: "2026./2027.",
  nnRef: "NN 58/26",
  nastavaStart: "2026-09-07",
  nastavaEnd: "2027-06-15",
  firstHalf: ["2026-09-07", "2026-12-23"],
  secondHalf: ["2027-01-07", "2027-06-15"],
  odmori: [
    { ime: "I. dio zimskog odmora", from: "2026-12-24", to: "2027-01-05" },
    { ime: "II. dio zimskog odmora", from: "2027-02-22", to: "2027-02-26" },
    { ime: "Proljetni odmor", from: "2027-03-25", to: "2027-04-02" },
    { ime: "Ljetni odmor", from: "2027-06-16", to: "2027-08-31" },
  ],
  blagdani: {
    "2026-11-01": "Svi sveti",
    "2026-11-18": "Dan sjećanja",
    "2026-12-25": "Božić",
    "2026-12-26": "Sveti Stjepan",
    "2027-01-01": "Nova godina",
    "2027-01-06": "Sveta tri kralja",
    "2027-03-28": "Uskrs",
    "2027-03-29": "Uskrsni ponedjeljak",
    "2027-05-01": "Praznik rada",
    "2027-05-27": "Tijelovo",
    "2027-05-30": "Dan državnosti",
    "2027-06-22": "Dan antifašističke borbe",
    "2027-08-05": "Dan pobjede i domovinske zahvalnosti",
    "2027-08-15": "Velika Gospa",
  },
  // NCVVO — Kalendar provedbe nacionalnih ispita 2026./2027. (svi ispiti u 9:00
  // osim gdje je naznačeno; dani provedbe su redoviti nastavni dani).
  ispiti: {
    // 4. razred (1.–5. ožujka 2027.)
    "2027-03-01": [{ razred: 4, predmet: "Hrvatski jezik", vrijeme: "9:00" }],
    "2027-03-02": [{ razred: 4, predmet: "Jezik nacionalne manjine", vrijeme: "9:00" }],
    "2027-03-03": [{ razred: 4, predmet: "Matematika", vrijeme: "9:00" }],
    "2027-03-05": [
      { razred: 4, predmet: "Priroda i društvo / Prirodoslovlje", vrijeme: "9:00" },
      { razred: 4, predmet: "Društvo i zajednica", vrijeme: "10:30" },
    ],
    // 8. razred (8.–24. ožujka 2027.)
    "2027-03-08": [{ razred: 8, predmet: "Hrvatski jezik", vrijeme: "9:00" }],
    "2027-03-09": [{ razred: 8, predmet: "Jezik nacionalne manjine", vrijeme: "9:00" }],
    "2027-03-10": [{ razred: 8, predmet: "Matematika", vrijeme: "9:00" }],
    "2027-03-12": [{ razred: 8, predmet: "Prvi strani jezik", vrijeme: "9:00" }],
    "2027-03-15": [{ razred: 8, predmet: "Geografija", vrijeme: "9:00" }],
    "2027-03-17": [{ razred: 8, predmet: "Fizika", vrijeme: "9:00" }],
    "2027-03-19": [{ razred: 8, predmet: "Biologija", vrijeme: "9:00" }],
    "2027-03-22": [{ razred: 8, predmet: "Kemija", vrijeme: "9:00" }],
    "2027-03-24": [{ razred: 8, predmet: "Povijest", vrijeme: "9:00" }],
  },
};

export const MJESECI = [
  "siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj",
  "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac",
];

/** Weekday headers, Monday-first. */
export const DANI = ["P", "U", "S", "Č", "P", "S", "N"];

/** ISO yyyy-mm-dd from a Date using LOCAL components (never toISOString — UTC shifts the day). */
export function isoLocal(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Today's date in Croatia (Europe/Zagreb), as ISO yyyy-mm-dd — stable server→client. */
export function todayZagreb(now: Date = new Date()): string {
  // en-CA gives yyyy-mm-dd; the timeZone makes it independent of the server's TZ.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "2026-11-01" → "1. 11. 2026." */
export function fmtHr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}. ${Number(m)}. ${y}.`;
}

/** Whole days from `a` to `b` (both ISO). Positive when b is after a. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

const inRange = (s: string, from: string, to: string) => s >= from && s <= to;

/** Classify one day. School-entered days win, then holidays, then weekend/breaks. */
export function classifyDay(
  iso: string,
  weekday: number, // 0=Sun … 6=Sat
  school: Map<string, string>,
  cfg: YearConfig = SCHOOL_YEAR,
): DayType {
  if (school.has(iso)) return "skola";
  if (cfg.blagdani[iso]) return "blagdan";
  if (weekday === 0 || weekday === 6) return "vikend";
  for (const o of cfg.odmori) if (inRange(iso, o.from, o.to)) return "odmor";
  if (iso >= cfg.nastavaStart && iso <= cfg.nastavaEnd) return "nastava";
  return "nenastava";
}

export interface DayCell {
  day: number;
  iso: string;
  type: DayType;
  label: string; // tooltip / aria text
  exam?: ExamDay[]; // national-exam sittings on this day (overlay; type stays "nastava")
}

export interface MonthView {
  year: number;
  monthIndex: number; // 0-11
  name: string; // "RUJAN"
  nast: number; // teaching days in this month
  weeks: (DayCell | null)[][]; // Monday-first, null = padding
}

export interface CalendarView {
  months: MonthView[];
  totals: { nast: number; odmor: number; blagdan: number };
}

/**
 * Build the full 12-month view (rujan → kolovoz) plus totals.
 * `schoolDates` are the school-entered days (highest priority, colored blue).
 */
export function buildCalendar(
  schoolDates: SchoolDate[],
  cfg: YearConfig = SCHOOL_YEAR,
): CalendarView {
  const school = new Map(schoolDates.map((s) => [s.d, s.label]));
  const yearA = Number(cfg.nastavaStart.slice(0, 4));
  const yearB = yearA + 1;
  const order = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7]; // rujan..kolovoz

  const months: MonthView[] = [];
  let totN = 0, totO = 0, totB = 0;

  for (const m of order) {
    const year = m >= 8 ? yearA : yearB;
    const dim = new Date(year, m + 1, 0).getDate();
    const startW = (new Date(year, m, 1).getDay() + 6) % 7; // Mon=0

    const weeks: (DayCell | null)[][] = [];
    let week: (DayCell | null)[] = new Array(startW).fill(null);
    let nast = 0;

    for (let day = 1; day <= dim; day++) {
      const dt = new Date(year, m, day);
      const iso = isoLocal(dt);
      const type = classifyDay(iso, dt.getDay(), school, cfg);
      if (type === "nastava") { nast++; totN++; }
      else if (type === "odmor") totO++;
      else if (type === "blagdan") totB++;

      const exam = cfg.ispiti[iso];
      const label =
        school.get(iso) ??
        cfg.blagdani[iso] ??
        (exam ? `Nacionalni ispit: ${exam.map((e) => e.predmet).join(", ")}`
          : type === "odmor" ? "odmor učenika"
          : type === "nastava" ? "nastavni dan"
          : type === "vikend" ? "vikend"
          : "");

      week.push({ day, iso, type, label, exam });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }

    months.push({ year, monthIndex: m, name: MJESECI[m].toUpperCase(), nast, weeks });
  }

  return { months, totals: { nast: totN, odmor: totO, blagdan: totB } };
}

export interface UpcomingEvent {
  d: string;
  label: string;
  kind: "blagdan" | "skola";
}

/** Events from `fromIso` onward (holidays + school-entered), soonest first. */
export function upcomingEvents(
  schoolDates: SchoolDate[],
  fromIso: string,
  limit = 6,
  cfg: YearConfig = SCHOOL_YEAR,
): UpcomingEvent[] {
  const events: UpcomingEvent[] = [
    ...Object.entries(cfg.blagdani).map(([d, label]) => ({ d, label, kind: "blagdan" as const })),
    ...schoolDates.map((s) => ({ d: s.d, label: s.label, kind: "skola" as const })),
  ];
  return events
    .filter((e) => e.d >= fromIso)
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(0, limit);
}

export interface ExamEntry extends ExamDay {
  d: string; // ISO yyyy-mm-dd
}

/** All national-exam sittings, soonest first (optionally for one grade). */
export function examSchedule(cfg: YearConfig = SCHOOL_YEAR, razred?: 4 | 8): ExamEntry[] {
  return Object.entries(cfg.ispiti)
    .flatMap(([d, days]) => days.map((e) => ({ d, ...e })))
    .filter((e) => razred === undefined || e.razred === razred)
    .sort((a, b) => a.d.localeCompare(b.d));
}

/** Humanized "za koliko" label for an upcoming date relative to today. */
export function relativeHr(fromIso: string, toIso: string): string {
  const n = daysBetween(fromIso, toIso);
  if (n <= 0) return "danas";
  if (n === 1) return "sutra";
  if (n < 5) return `za ${n} dana`;
  return `za ${n} dana`;
}
