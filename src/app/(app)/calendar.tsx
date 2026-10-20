"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addSchoolDate, removeSchoolDate } from "./calendar-actions";
import {
  buildCalendar,
  upcomingEvents,
  fmtHr,
  relativeHr,
  SCHOOL_YEAR,
  DANI,
  type SchoolDate,
  type DayType,
} from "@/lib/school-calendar";

/** Background + text classes per day type (pastel chips readable on light & dark). */
const CELL: Record<DayType, string> = {
  nastava: "text-black/80 dark:text-white/80",
  nenastava: "text-black/50 dark:text-white/50",
  vikend: "bg-slate-100 text-slate-400 dark:bg-white/[0.04] dark:text-white/30",
  odmor: "bg-amber-200/80 text-amber-900",
  blagdan: "bg-red-200/80 text-red-900 font-semibold",
  skola: "bg-blue-200/90 text-blue-900 font-semibold",
};

const SW: Record<Exclude<DayType, "nenastava">, string> = {
  nastava: "bg-white border border-black/15 dark:bg-white/10 dark:border-white/20",
  vikend: "bg-slate-200 dark:bg-white/10",
  odmor: "bg-amber-200",
  blagdan: "bg-red-200",
  skola: "bg-blue-300",
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
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-black/60 dark:text-white/60">
      {items.map(([label, key]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <i className={`h-3.5 w-3.5 rounded ${SW[key]}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Spremam…" : "Dodaj u kalendar"}
    </button>
  );
}

export function Calendar({
  schoolDates,
  today,
}: {
  schoolDates: SchoolDate[];
  today: string;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const cfg = SCHOOL_YEAR;
  const { months, totals } = buildCalendar(schoolDates, cfg);
  const upcoming = upcomingEvents(schoolDates, today, 6, cfg);
  const sorted = [...schoolDates].sort((a, b) => a.d.localeCompare(b.d));

  // Toast: next upcoming event. Shown by default; hidden once its key is
  // dismissed (manually or by the auto-timeout). A new soonest event → new key
  // → shows again. Visibility is derived (no setState-in-effect).
  const next = upcoming[0];
  const nextKey = next ? `${next.d}|${next.label}` : null;
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const toast = nextKey !== null && hiddenKey !== nextKey;
  useEffect(() => {
    if (!nextKey) return;
    const t = setTimeout(() => setHiddenKey(nextKey), 9000);
    return () => clearTimeout(t);
  }, [nextKey]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Kalendar — školska godina {cfg.label}
          </h1>
          <p className="mt-0.5 text-sm text-black/55 dark:text-white/55">
            Temeljem Odluke MZOM ({cfg.nnRef}). Dan škole, Dan grada/općine i
            nenastavne dane škola upisuje sama.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
            formOpen
              ? "border-blue-600 text-blue-700 dark:text-blue-300"
              : "border-blue-600 bg-blue-600 text-white hover:opacity-90"
          }`}
        >
          ＋ Dodaj važan datum
        </button>
      </div>

      {/* Add form */}
      {formOpen ? (
        <form
          ref={formRef}
          action={async (fd) => {
            await addSchoolDate(fd);
            formRef.current?.reset();
          }}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Datum
            <input
              type="date"
              name="d"
              required
              min={`${cfg.nastavaStart.slice(0, 4)}-09-01`}
              max={`${Number(cfg.nastavaStart.slice(0, 4)) + 1}-08-31`}
              className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Naziv (npr. Dan škole, Dan grada)
            <input
              type="text"
              name="label"
              required
              maxLength={120}
              placeholder="Dan škole"
              className="min-w-[240px] rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5"
            />
          </label>
          <AddButton />
          <p className="basis-full text-xs text-black/45 dark:text-white/45">
            Ovdje škola upisuje svoje dane (Dan škole, Dan grada/općine,
            nenastavni radni dani…). Sprema se u profil škole.
          </p>
        </form>
      ) : null}

      <Legend />

      {/* 12-month grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {months.map((mo) => {
          const isCur = today.startsWith(
            `${mo.year}-${String(mo.monthIndex + 1).padStart(2, "0")}`,
          );
          return (
            <div
              key={`${mo.year}-${mo.monthIndex}`}
              className={`rounded-xl border bg-white p-2.5 shadow-sm dark:bg-white/[0.03] ${
                isCur
                  ? "border-blue-300 ring-1 ring-blue-200 dark:border-blue-500/50 dark:ring-blue-500/20"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <div className="mb-1.5 flex items-baseline justify-between px-0.5">
                <b className="text-[13px] tracking-tight">
                  {mo.name} {mo.year}
                </b>
                <span className="text-[11px] text-black/40 dark:text-white/40">
                  {mo.nast} nast.
                </span>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {DANI.map((h, i) => (
                  <div
                    key={i}
                    className="pb-0.5 text-[10px] font-semibold text-black/40 dark:text-white/40"
                  >
                    {h}
                  </div>
                ))}
                {mo.weeks.flat().map((cell, i) =>
                  cell ? (
                    <div
                      key={i}
                      title={`${cell.day}. ${mo.name.toLowerCase()} — ${cell.label}`}
                      className={`flex h-7 items-center justify-center rounded-md text-[12px] ${CELL[cell.type]} ${
                        cell.iso === today
                          ? "font-bold text-blue-700 ring-2 ring-inset ring-blue-600 dark:text-blue-300"
                          : ""
                      }`}
                    >
                      {cell.day}
                    </div>
                  ) : (
                    <div key={i} className="h-7" />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Nastavna godina
          </h3>
          <Row label="I. polugodište">
            <span className="tabular-nums">
              {fmtHr(cfg.firstHalf[0])} – {fmtHr(cfg.firstHalf[1])}
            </span>
          </Row>
          <Row label="II. polugodište">
            <span className="tabular-nums">
              {fmtHr(cfg.secondHalf[0])} – {fmtHr(cfg.secondHalf[1])}
            </span>
          </Row>
          <Row label="Nastavni dani">
            <b>{totals.nast}</b>
          </Row>
          <Row label="Odmor / blagdani">
            <b>
              {totals.odmor} / {totals.blagdan}
            </b>
          </Row>
          <p className="mt-1.5 text-[11px] text-black/40 dark:text-white/40">
            Propisani minimum: 175 nastavnih dana.
          </p>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Nadolazeći događaji
          </h3>
          {upcoming.length ? (
            upcoming.map((e) => (
              <Row key={`${e.d}-${e.label}`} label={
                <span className="inline-flex items-center gap-2">
                  <i className={`h-2.5 w-2.5 rounded ${e.kind === "skola" ? "bg-blue-300" : "bg-red-200"}`} />
                  {e.label}
                </span>
              }>
                <span className="tabular-nums text-black/60 dark:text-white/60">
                  {fmtHr(e.d)}
                </span>
              </Row>
            ))
          ) : (
            <p className="py-1 text-[13px] text-black/40 dark:text-white/40">
              Nema nadolazećih događaja.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Važni datumi škole
          </h3>
          {sorted.length ? (
            sorted.map((s) => (
              <div
                key={s.id ?? s.d}
                className="flex items-center justify-between gap-2 border-b border-dashed border-black/5 py-1 text-[13px] last:border-0 dark:border-white/10"
              >
                <span className="inline-flex items-center gap-2">
                  <i className="h-2.5 w-2.5 rounded bg-blue-300" />
                  {s.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="tabular-nums text-black/60 dark:text-white/60">
                    {fmtHr(s.d)}
                  </span>
                  {s.id ? (
                    <form action={removeSchoolDate.bind(null, s.id)}>
                      <button
                        type="submit"
                        title="Ukloni"
                        className="px-1 text-base leading-none text-black/25 transition-colors hover:text-red-500 dark:text-white/25"
                      >
                        ×
                      </button>
                    </form>
                  ) : null}
                </span>
              </div>
            ))
          ) : (
            <p className="py-1 text-[13px] text-black/40 dark:text-white/40">
              Još nema unesenih datuma. Dodajte Dan škole, Dan grada…
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-black/40 dark:text-white/40">
            Škola unosi sama (čl. 7. Odluke).
          </p>
        </div>
      </div>

      {/* Toast: next upcoming event */}
      {toast && next ? (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 shadow-lg dark:border-white/15 dark:bg-neutral-900"
        >
          <span className="mt-0.5 text-lg leading-none">🔔</span>
          <div className="min-w-0 text-sm">
            <p className="text-black/50 dark:text-white/50">Sljedeći događaj</p>
            <p className="font-medium">
              {next.label}
            </p>
            <p className="text-black/60 dark:text-white/60">
              {fmtHr(next.d)} · {relativeHr(today, next.d)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHiddenKey(nextKey)}
            aria-label="Zatvori"
            className="ml-1 text-black/30 transition-colors hover:text-black/60 dark:text-white/30 dark:hover:text-white/70"
          >
            ×
          </button>
        </div>
      ) : null}
    </main>
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
    <div className="flex items-center justify-between gap-2 border-b border-dashed border-black/5 py-1 text-[13px] last:border-0 dark:border-white/10">
      <span>{label}</span>
      {children}
    </div>
  );
}
