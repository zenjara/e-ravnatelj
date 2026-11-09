"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addSchoolDate, removeSchoolDate } from "./calendar-actions";
import {
  buildCalendar,
  upcomingEvents,
  examSchedule,
  fmtHr,
  relativeHr,
  SCHOOL_YEAR,
  DANI,
  type SchoolDate,
  type DayType,
  type ExamEntry,
  type DayCell as DayCellData,
} from "@/lib/school-calendar";
import { rokRelative, type UpcomingRok } from "@/lib/rokovnik";

/** Background + text classes per day type, tuned to the editorial palette. */
const CELL: Record<DayType, string> = {
  nastava: "text-ink",
  nenastava: "text-muted",
  vikend: "bg-bg-tint text-faint",
  odmor: "bg-gold-weak text-[color:var(--gold)]",
  blagdan: "bg-good-weak text-good font-medium",
  skola: "bg-accent-soft text-accent font-semibold",
};

const SW: Record<Exclude<DayType, "nenastava">, string> = {
  nastava: "bg-surface border border-line-strong",
  vikend: "bg-bg-tint",
  odmor: "bg-gold-weak",
  blagdan: "bg-good-weak",
  skola: "bg-accent-soft",
};

/** National-exam grade → distinct colors (4. razred zlatno, 8. razred plavo). */
const EXAM_DOT: Record<4 | 8, string> = { 4: "bg-gold", 8: "bg-accent" };
const EXAM_TEXT: Record<4 | 8, string> = { 4: "text-gold", 8: "text-accent" };

const TYPE_LABEL: Record<DayType, string> = {
  nastava: "Nastavni dan",
  nenastava: "Nenastavni dan",
  vikend: "Vikend",
  odmor: "Odmor učenika",
  blagdan: "Blagdan / praznik",
  skola: "Dan škole / grada",
};

/** Jedinstveni razredi (4/8) koji imaju ispit na ovaj dan. */
const examGrades = (exam?: { razred: 4 | 8 }[]): (4 | 8)[] =>
  exam ? Array.from(new Set(exam.map((e) => e.razred))).sort() : [];

/** Hrvatska množina za "dan": 1/21/31… → "dan", inače "dana". */
const dayWord = (n: number) => {
  const a = Math.abs(n) % 100;
  return a % 10 === 1 && a !== 11 ? "dan" : "dana";
};

function Legend() {
  const items: [string, keyof typeof SW][] = [
    ["Nastavni dan", "nastava"],
    ["Odmor učenika", "odmor"],
    ["Blagdan / praznik", "blagdan"],
    ["Dan škole / grada / općine", "skola"],
    ["Vikend", "vikend"],
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      {items.map(([label, key]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <i className={`h-3.5 w-3.5 rounded ${SW[key]}`} />
          {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <i className="h-2 w-2 rounded-full bg-gold" />
        NI 4. razred
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="h-2 w-2 rounded-full bg-accent" />
        NI 8. razred
      </span>
    </div>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
    >
      {pending ? "Spremam…" : "Dodaj u kalendar"}
    </button>
  );
}

const inputCls =
  "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/10";

export function Calendar({
  schoolDates,
  today,
  rokovnik = [],
}: {
  schoolDates: SchoolDate[];
  today: string;
  rokovnik?: UpcomingRok[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [openRok, setOpenRok] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const cfg = SCHOOL_YEAR;
  const { months, totals } = buildCalendar(schoolDates, cfg);
  const upcoming = upcomingEvents(schoolDates, today, 6, cfg);
  const sorted = [...schoolDates].sort((a, b) => a.d.localeCompare(b.d));
  const ispiti4 = examSchedule(cfg, 4);
  const ispiti8 = examSchedule(cfg, 8);

  // Protok školske godine (kalendarski dani od nastavaStart do nastavaEnd).
  const daysBetween = (a: string, b: string) =>
    Math.round(
      (new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000,
    );
  const yrPassed = daysBetween(cfg.nastavaStart, today);
  const yrTotal = daysBetween(cfg.nastavaStart, cfg.nastavaEnd);
  const yrLeft = daysBetween(today, cfg.nastavaEnd);
  const yrPct = Math.max(0, Math.min(100, Math.round((yrPassed / yrTotal) * 100)));
  const yrStarted = yrPassed >= 0;
  const yrEnded = yrLeft < 0;

  const next = upcoming[0];
  const nextKey = next ? `${next.d}|${next.label}` : null;
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const toast = nextKey !== null && hiddenKey !== nextKey;
  useEffect(() => {
    if (!nextKey) return;
    const t = setTimeout(() => setHiddenKey(nextKey), 9000);
    return () => clearTimeout(t);
  }, [nextKey]);

  // Collapsible "Nacionalni ispiti" card.
  const [ispitiOpen, setIspitiOpen] = useState(false);
  // Day tooltip: pinned on click (activeDay) + shown on hover (hoverDay).
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  useEffect(() => {
    if (!activeDay) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-daycell]")) setActiveDay(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [activeDay]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-5 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-gold">
            Školska godina {cfg.label}
          </p>
          <h1 className="font-serif text-[1.9rem] font-semibold leading-tight tracking-tight text-ink">
            Kalendar
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            Temeljem Odluke MZOM ({cfg.nnRef}). Dan škole, Dan grada/općine i
            nenastavne dane škola upisuje sama.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
            formOpen
              ? "border-accent text-accent hover:bg-accent-weak"
              : "border-transparent bg-accent text-accent-ink hover:bg-accent-hover"
          }`}
        >
          ＋ Dodaj važan datum
        </button>
      </div>

      {/* Protok školske godine (box iznad kalendara) */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
        {yrEnded ? (
          <p className="text-sm text-muted">
            Školska godina {cfg.label} je završila ({fmtHr(cfg.nastavaEnd)}).
          </p>
        ) : !yrStarted ? (
          <p className="text-sm text-ink">
            Nastava počinje za{" "}
            <b className="font-serif text-xl font-semibold text-accent tabular-nums">{-yrPassed}</b>{" "}
            {dayWord(yrPassed)} <span className="text-muted">({fmtHr(cfg.nastavaStart)}).</span>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <p className="text-sm text-muted">
                Od početka školske godine prošlo je{" "}
                <b className="font-serif text-xl font-semibold text-accent tabular-nums">{yrPassed}</b>{" "}
                {dayWord(yrPassed)}
              </p>
              <p className="text-sm text-muted sm:text-right">
                Do kraja ostalo je{" "}
                <b className="font-serif text-xl font-semibold text-gold tabular-nums">{yrLeft}</b>{" "}
                {dayWord(yrLeft)}
              </p>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-tint">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${yrPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[0.68rem] text-faint tabular-nums">
              <span>{fmtHr(cfg.nastavaStart)}</span>
              <span>{yrPct}%</span>
              <span>{fmtHr(cfg.nastavaEnd)}</span>
            </div>
          </>
        )}
      </div>

      {/* Add form */}
      {formOpen ? (
        <form
          ref={formRef}
          action={async (fd) => {
            await addSchoolDate(fd);
            formRef.current?.reset();
          }}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-bg-tint p-4"
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            Datum
            <input
              type="date"
              name="d"
              required
              min={`${cfg.nastavaStart.slice(0, 4)}-09-01`}
              max={`${Number(cfg.nastavaStart.slice(0, 4)) + 1}-08-31`}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Naziv (npr. Dan škole, Dan grada)
            <input
              type="text"
              name="label"
              required
              maxLength={120}
              placeholder="Dan škole"
              className={`${inputCls} min-w-[240px] placeholder:text-faint`}
            />
          </label>
          <AddButton />
          <p className="basis-full text-xs text-faint">
            Ovdje škola upisuje svoje dane (Dan škole, Dan grada/općine,
            nenastavni radni dani…). Sprema se u profil škole.
          </p>
        </form>
      ) : null}

      <Legend />

      {/* 12-month grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {months.map((mo) => {
          const curKey = Number(today.slice(0, 4)) * 12 + (Number(today.slice(5, 7)) - 1);
          const moKey = mo.year * 12 + mo.monthIndex;
          const isCur = moKey === curKey;
          const isPast = moKey < curKey;
          return (
            <div
              key={`${mo.year}-${mo.monthIndex}`}
              className={`rounded-xl border bg-surface p-3 transition-opacity ${
                isCur
                  ? "border-accent shadow-[var(--shadow-lg)] ring-2 ring-accent/20"
                  : isPast
                    ? "border-line opacity-55 shadow-[var(--shadow)] hover:opacity-100"
                    : "border-line shadow-[var(--shadow)]"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between px-0.5">
                <b
                  className={`font-serif text-[0.95rem] font-semibold tracking-tight ${
                    isCur ? "text-accent" : "text-ink"
                  }`}
                >
                  {mo.name[0] + mo.name.slice(1).toLowerCase()} {mo.year}
                </b>
                {isCur ? (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-accent-ink">
                    sada
                  </span>
                ) : (
                  <span className="text-[0.6875rem] text-faint">{mo.nast} nast.</span>
                )}
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {DANI.map((h, i) => (
                  <div
                    key={i}
                    className="pb-1 text-[0.625rem] font-semibold uppercase text-faint"
                  >
                    {h}
                  </div>
                ))}
                {mo.weeks.flat().map((cell, i) =>
                  cell ? (
                    <DayCell
                      key={i}
                      cell={cell}
                      monthName={mo.name.toLowerCase()}
                      year={mo.year}
                      today={today}
                      open={activeDay === cell.iso || hoverDay === cell.iso}
                      pinned={activeDay === cell.iso}
                      onToggle={() =>
                        setActiveDay((k) => (k === cell.iso ? null : cell.iso))
                      }
                      onHover={(on) => setHoverDay(on ? cell.iso : null)}
                    />
                  ) : (
                    <div key={i} className="h-7" />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Nacionalni ispiti (NCVVO) — collapsible */}
      {ispiti4.length || ispiti8.length ? (
        <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
          <button
            type="button"
            onClick={() => setIspitiOpen((o) => !o)}
            aria-expanded={ispitiOpen}
            className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-bg-tint/50"
          >
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="font-serif text-lg font-semibold text-ink">
                Nacionalni ispiti (NCVVO)
              </h2>
              <span className="flex items-center gap-2 text-[0.7rem] font-medium">
                <span className="inline-flex items-center gap-1 text-gold">
                  <i className="h-2 w-2 rounded-full bg-gold" /> 4. razred
                </span>
                <span className="inline-flex items-center gap-1 text-accent">
                  <i className="h-2 w-2 rounded-full bg-accent" /> 8. razred
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="hidden text-xs text-faint sm:inline">ožujak 2027.</span>
              <span
                aria-hidden
                className={`text-[0.7rem] text-faint transition-transform ${ispitiOpen ? "rotate-90" : ""}`}
              >
                ▶
              </span>
            </span>
          </button>
          {ispitiOpen ? (
            <div className="border-t border-line px-5 pb-5 pt-4">
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                <ExamList title="4. razred" entries={ispiti4} razred={4} />
                <ExamList title="8. razred" entries={ispiti8} razred={8} />
              </div>
              <p className="mt-4 text-[0.68rem] text-faint">
                Svi ispiti počinju u 9:00 (osim gdje je naznačeno). Jezik nacionalne
                manjine pišu samo učenici koji se školuju na jeziku i pismu nacionalnih
                manjina. Izvor: NCVVO — Kalendar provedbe nacionalnih ispita 2026./2027.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Nadolazeći rokovi (globalni zakonski rokovi) — ispod kalendara */}
      {rokovnik.length ? (
        <section className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-serif text-lg font-semibold text-ink">Nadolazeći rokovi</h2>
            <span className="text-xs text-faint">zakonski rokovi · informativno</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {rokovnik.map((r) => {
              const open = openRok === r.slug;
              return (
                <div
                  key={r.slug}
                  className={`rounded-lg border p-3 ${
                    r.soon ? "border-gold/45 bg-gold-weak/50" : "border-line bg-bg-tint/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-gold">
                        {r.kategorija}
                      </p>
                      <p className="font-medium text-ink">{r.naziv}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        r.soon ? "bg-gold text-white" : "bg-accent-weak text-accent"
                      }`}
                    >
                      {rokRelative(r.daysUntil)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="tabular-nums">{r.dateHr}</span>
                    {r.provjeriti ? (
                      <span className="text-faint" title="Datum treba potvrditi">⚠ provjeriti</span>
                    ) : null}
                    {r.checklist.length ? (
                      <button
                        type="button"
                        onClick={() => setOpenRok(open ? null : r.slug)}
                        aria-expanded={open}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-weak px-2.5 py-1 text-[0.72rem] font-semibold text-accent transition-colors hover:border-accent/60 hover:bg-accent/10"
                      >
                        {open ? "Sakrij korake" : "Prikaži korake"}
                        <span className="rounded bg-accent/15 px-1 text-[0.62rem] tabular-nums">
                          {r.checklist.length}
                        </span>
                        <span
                          aria-hidden
                          className={`text-[0.7em] transition-transform ${open ? "rotate-180" : ""}`}
                        >
                          ▾
                        </span>
                      </button>
                    ) : null}
                  </div>
                  {open && r.checklist.length ? (
                    <ol className="mt-2.5 space-y-1.5 border-t border-line/60 pt-2.5">
                      {r.checklist.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-ink/80">
                          <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-weak text-[0.6rem] font-semibold text-accent tabular-nums">
                            {i + 1}
                          </span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {r.osnova ? (
                    <p className="mt-1.5 text-[0.68rem] text-faint">Osnova: {r.osnova}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Nastavna godina">
          <Row label="I. polugodište">
            <span className="tabular-nums text-muted">
              {fmtHr(cfg.firstHalf[0])} – {fmtHr(cfg.firstHalf[1])}
            </span>
          </Row>
          <Row label="II. polugodište">
            <span className="tabular-nums text-muted">
              {fmtHr(cfg.secondHalf[0])} – {fmtHr(cfg.secondHalf[1])}
            </span>
          </Row>
          <Row label="Nastavni dani">
            <b className="text-ink">{totals.nast}</b>
          </Row>
          <Row label="Odmor / blagdani">
            <b className="text-ink">
              {totals.odmor} / {totals.blagdan}
            </b>
          </Row>
          <p className="mt-2 text-[0.6875rem] text-faint">
            Propisani minimum: 175 nastavnih dana.
          </p>
        </Card>

        <Card title="Nadolazeći događaji">
          {upcoming.length ? (
            upcoming.map((e) => (
              <Row
                key={`${e.d}-${e.label}`}
                label={
                  <span className="inline-flex items-center gap-2 text-ink">
                    <i className={`h-2.5 w-2.5 rounded ${e.kind === "skola" ? "bg-accent-soft" : "bg-good-weak"}`} />
                    {e.label}
                  </span>
                }
              >
                <span className="tabular-nums text-muted">{fmtHr(e.d)}</span>
              </Row>
            ))
          ) : (
            <p className="py-1 text-[0.8125rem] text-faint">Nema nadolazećih događaja.</p>
          )}
        </Card>

        <Card title="Važni datumi škole">
          {sorted.length ? (
            sorted.map((s) => (
              <div
                key={s.id ?? s.d}
                className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5 text-[0.8125rem] last:border-0"
              >
                <span className="inline-flex items-center gap-2 text-ink">
                  <i className="h-2.5 w-2.5 rounded bg-accent-soft" />
                  {s.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="tabular-nums text-muted">{fmtHr(s.d)}</span>
                  {s.id ? (
                    <form action={removeSchoolDate.bind(null, s.id)}>
                      <button
                        type="submit"
                        title="Ukloni"
                        className="px-1 text-base leading-none text-faint transition-colors hover:text-bad"
                      >
                        ×
                      </button>
                    </form>
                  ) : null}
                </span>
              </div>
            ))
          ) : (
            <p className="py-1 text-[0.8125rem] text-faint">
              Još nema unesenih datuma. Dodajte Dan škole, Dan grada…
            </p>
          )}
          <p className="mt-2 text-[0.6875rem] text-faint">Škola unosi sama (čl. 7. Odluke).</p>
        </Card>
      </div>

      {/* Toast: next upcoming event */}
      {toast && next ? (
        <div
          role="status"
          className="fixed bottom-24 right-5 z-40 flex max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-lg)]"
        >
          <span className="mt-0.5 text-lg leading-none">🔔</span>
          <div className="min-w-0 text-sm">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-gold">
              Sljedeći događaj
            </p>
            <p className="mt-0.5 font-medium text-ink">{next.label}</p>
            <p className="text-muted">
              {fmtHr(next.d)} · {relativeHr(today, next.d)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHiddenKey(nextKey)}
            aria-label="Zatvori"
            className="ml-1 text-faint transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      ) : null}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <h3 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-gold">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** One day in the month grid: colored cell + grade-colored exam dots + rich tooltip. */
function DayCell({
  cell,
  monthName,
  year,
  today,
  open,
  pinned,
  onToggle,
  onHover,
}: {
  cell: DayCellData;
  monthName: string;
  year: number;
  today: string;
  open: boolean;
  pinned: boolean;
  onToggle: () => void;
  onHover: (on: boolean) => void;
}) {
  const grades = examGrades(cell.exam);
  const isToday = cell.iso === today;
  return (
    <div
      className="relative"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <button
        type="button"
        data-daycell
        onClick={onToggle}
        className={`flex h-7 w-full items-center justify-center rounded-md text-[0.75rem] ${CELL[cell.type]} ${
          isToday ? "font-bold text-accent ring-2 ring-inset ring-accent" : ""
        } ${pinned && !isToday ? "ring-2 ring-inset ring-accent/50" : ""}`}
      >
        {cell.day}
        {grades.length ? (
          <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
            {grades.map((g) => (
              <i key={g} className={`h-1 w-1 rounded-full ${EXAM_DOT[g]}`} />
            ))}
          </span>
        ) : null}
      </button>
      {open ? <DayTooltip cell={cell} monthName={monthName} year={year} /> : null}
    </div>
  );
}

/** Rich day tooltip (hover + click): date, day type, and any national-exam sittings. */
function DayTooltip({
  cell,
  monthName,
  year,
}: {
  cell: DayCellData;
  monthName: string;
  year: number;
}) {
  const exam = cell.exam;
  const grades = examGrades(exam);
  const specific = cell.type === "blagdan" || cell.type === "skola" ? cell.label : null;
  const swatch = (SW as Record<string, string>)[cell.type] ?? "bg-bg-tint";
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[16rem] -translate-x-1/2 rounded-lg border border-line bg-surface p-3 text-left shadow-[var(--shadow-lg)]">
      <div className="text-[0.9rem] font-semibold text-ink">
        {cell.day}. {monthName} {year}.
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        <i className={`h-2.5 w-2.5 rounded ${swatch}`} />
        {TYPE_LABEL[cell.type]}
      </div>
      {specific ? <div className="mt-1 text-xs font-medium text-ink">{specific}</div> : null}
      {grades.length && exam ? (
        <div className="mt-2.5 space-y-2 border-t border-line pt-2.5">
          {grades.map((g) => (
            <div key={g}>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${EXAM_TEXT[g]}`}>
                <i className={`h-2 w-2 rounded-full ${EXAM_DOT[g]}`} />
                Nacionalni ispit · {g}. razred
              </div>
              <ul className="mt-1 ml-3.5 list-disc space-y-0.5 text-xs text-muted marker:text-faint">
                {exam
                  .filter((e) => e.razred === g)
                  .map((e, i) => (
                    <li key={i}>
                      {e.predmet}
                      <span className="text-faint"> · {e.vrijeme}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
      <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-line bg-surface" />
    </div>
  );
}

function ExamList({
  title,
  entries,
  razred,
}: {
  title: string;
  entries: ExamEntry[];
  razred: 4 | 8;
}) {
  const byDate = new Map<string, ExamEntry[]>();
  for (const e of entries) {
    const arr = byDate.get(e.d) ?? [];
    arr.push(e);
    byDate.set(e.d, arr);
  }
  return (
    <div>
      <p className={`mb-2 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] ${EXAM_TEXT[razred]}`}>
        <i className={`h-2 w-2 rounded-full ${EXAM_DOT[razred]}`} />
        {title}
      </p>
      <ul className="space-y-1">
        {[...byDate.entries()].map(([d, es]) => (
          <li
            key={d}
            className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1 text-[0.8125rem] last:border-0"
          >
            <span className="text-ink">
              {es.map((e, i) => (
                <span key={i}>
                  {i > 0 ? ", " : ""}
                  {e.predmet}
                  {e.vrijeme !== "9:00" ? (
                    <span className="text-faint"> ({e.vrijeme})</span>
                  ) : null}
                </span>
              ))}
            </span>
            <span className="shrink-0 tabular-nums text-muted">{fmtHr(d)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5 text-[0.8125rem] last:border-0">
      <span className="text-ink">{label}</span>
      {children}
    </div>
  );
}
