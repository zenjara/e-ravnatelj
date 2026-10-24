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

/** Background + text classes per day type, tuned to the editorial palette. */
const CELL: Record<DayType, string> = {
  nastava: "text-ink",
  nenastava: "text-muted",
  vikend: "bg-bg-tint text-faint",
  odmor: "bg-gold-weak text-[color:var(--gold)]",
  blagdan: "bg-bad-weak text-bad font-medium",
  skola: "bg-accent-soft text-accent font-semibold",
};

const SW: Record<Exclude<DayType, "nenastava">, string> = {
  nastava: "bg-surface border border-line-strong",
  vikend: "bg-bg-tint",
  odmor: "bg-gold-weak",
  blagdan: "bg-bad-weak",
  skola: "bg-accent-soft",
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
          const isCur = today.startsWith(
            `${mo.year}-${String(mo.monthIndex + 1).padStart(2, "0")}`,
          );
          return (
            <div
              key={`${mo.year}-${mo.monthIndex}`}
              className={`rounded-xl border bg-surface p-3 shadow-[var(--shadow)] ${
                isCur ? "border-accent/35 ring-1 ring-accent/15" : "border-line"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between px-0.5">
                <b className="font-serif text-[0.95rem] font-semibold tracking-tight text-ink">
                  {mo.name[0] + mo.name.slice(1).toLowerCase()} {mo.year}
                </b>
                <span className="text-[0.6875rem] text-faint">{mo.nast} nast.</span>
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
                    <div
                      key={i}
                      title={`${cell.day}. ${mo.name.toLowerCase()} — ${cell.label}`}
                      className={`flex h-7 items-center justify-center rounded-md text-[0.75rem] ${CELL[cell.type]} ${
                        cell.iso === today
                          ? "font-bold text-accent ring-2 ring-inset ring-accent"
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
                    <i className={`h-2.5 w-2.5 rounded ${e.kind === "skola" ? "bg-accent-soft" : "bg-bad-weak"}`} />
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
          className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-lg)]"
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
