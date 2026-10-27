"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedback } from "./feedback-actions";

const KATEGORIJE: [string, string][] = [
  ["prijedlog", "Prijedlog / ideja"],
  ["greška", "Greška / nešto ne radi"],
  ["pitanje", "Pitanje"],
  ["ostalo", "Ostalo"],
];

/**
 * Floating beta-feedback widget, present on every /app screen (rendered from
 * AppShell). A pill FAB opens a small form; the message is stored in the
 * `feedback` table via `submitFeedback`. The current path is attached so we
 * know which screen the note is about.
 */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const pathname = usePathname();

  async function onSubmit(fd: FormData) {
    setSending(true);
    setFailed(false);
    fd.set("stranica", pathname);
    const res = await submitFeedback(fd);
    setSending(false);
    if (res.ok) {
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 2400);
    } else {
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setSent(false);
          setFailed(false);
        }}
        aria-label="Pošalji prijedlog ili opasku"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-ink shadow-[var(--shadow-lg)] transition-colors hover:bg-accent-hover"
      >
        <span className="text-base leading-none">💬</span>
        <span className="hidden sm:inline">Prijedlog</span>
        <span className="rounded-full bg-gold px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-white">
          Beta
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Prijedlozi i opaske"
          className="fixed bottom-20 right-5 z-50 w-[min(92vw,22rem)] rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-lg)]"
        >
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-gold">
                Beta · povratne informacije
              </p>
              <h2 className="font-serif text-base font-semibold text-ink">
                Vaš prijedlog ili opaska
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Zatvori"
              className="text-faint transition-colors hover:text-ink"
            >
              ×
            </button>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-2.5 rounded-lg bg-good-weak px-5 py-9 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-good/15 text-xl font-bold text-good">
                ✓
              </span>
              <p className="text-sm font-semibold text-good">
                Hvala! Vaša poruka je zaprimljena.
              </p>
              <p className="text-xs leading-relaxed text-muted">
                Javit ćemo se ako nam zatreba više detalja.
              </p>
            </div>
          ) : (
            <form action={onSubmit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Vrsta
                <select
                  name="kategorija"
                  defaultValue="prijedlog"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239a9488' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0.85rem center",
                  }}
                  className="w-full appearance-none rounded-lg border border-line bg-surface px-3 py-2.5 pr-10 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/10"
                >
                  {KATEGORIJE.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Poruka
                <textarea
                  name="poruka"
                  required
                  rows={4}
                  maxLength={4000}
                  placeholder="Što bismo mogli poboljšati, što ne radi, što vam nedostaje…"
                  className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/10"
                />
              </label>
              {failed ? (
                <p className="text-xs text-bad">
                  Slanje nije uspjelo. Pokušajte ponovno za koji trenutak.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={sending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {sending ? "Šaljem…" : "Pošalji"}
              </button>
              <p className="text-[0.66rem] text-faint">
                Vidimo na kojem ste ekranu da lakše razumijemo prijedlog.
              </p>
            </form>
          )}
        </div>
      ) : null}
    </>
  );
}
