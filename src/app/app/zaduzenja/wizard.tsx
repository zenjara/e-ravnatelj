"use client";

import { useRef, useState } from "react";

interface TeacherLite {
  name: string;
  predmet: string;
  radno_vrijeme: string;
  ukupno_tjedno: number;
}
interface Parsed {
  school: { naziv: string; mjesto: string; ravnatelj: string; zupanija: string };
  teachers: TeacherLite[];
}

type Step = "upload" | "review" | "generating" | "done";

const asciiSlug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "skola";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const inputCls =
  "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/10";

const STEPS: [Step, string][] = [
  ["upload", "Učitavanje tablice"],
  ["review", "Provjera i postavke"],
  ["done", "Preuzimanje"],
];

function Stepper({ current }: { current: Step }) {
  const idx = current === "generating" ? 2 : STEPS.findIndex(([s]) => s === current);
  return (
    <ol className="mb-7 flex flex-wrap gap-x-2 gap-y-2">
      {STEPS.map(([s, label], i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                active
                  ? "bg-accent text-accent-ink"
                  : done
                    ? "bg-accent-weak text-accent"
                    : "bg-bg-tint text-faint"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`text-sm ${active ? "font-semibold text-ink" : "text-muted"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="mx-1 hidden text-line-strong sm:inline">———</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function ZaduzenjaWizard({ defaultGodina }: { defaultGodina: string }) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState(false);

  const [klasa, setKlasa] = useState("602-01/26-05/1");
  const [urbrojBase, setUrbrojBase] = useState("2181-290-01-26");
  const [godina, setGodina] = useState(defaultGodina);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState("Odluke.pdf");
  const [zipBusy, setZipBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    if (!/\.xlsx?$/i.test(f.name)) {
      setError("Datoteka mora biti Excel tablica (.xlsx).");
      return;
    }
    setError(null);
    setFile(f);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/zaduzenja/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Nije moguće pročitati tablicu.");
        setFile(null);
        return;
      }
      setParsed(data as Parsed);
      setStep("review");
    } catch {
      setError("Došlo je do greške pri čitanju. Pokušajte ponovno.");
      setFile(null);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!file) return;
    if (!klasa.trim() || !urbrojBase.trim() || !godina.trim()) {
      setError("Upišite KLASA, URBROJ i školsku godinu.");
      return;
    }
    setError(null);
    setStep("generating");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("klasa", klasa.trim());
      fd.append("urbrojBase", urbrojBase.trim());
      fd.append("godina", godina.trim());
      fd.append("format", "pdf");
      const res = await fetch("/api/zaduzenja/generate", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Generiranje nije uspjelo.");
        setStep("review");
        return;
      }
      const blob = await res.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
      setPdfName(`Odluke-${asciiSlug(parsed?.school.naziv ?? "skola")}.pdf`);
      setStep("done");
    } catch {
      setError("Došlo je do greške pri generiranju. Pokušajte ponovno.");
      setStep("review");
    }
  }

  async function downloadZip() {
    if (!file) return;
    setZipBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("klasa", klasa.trim());
      fd.append("urbrojBase", urbrojBase.trim());
      fd.append("godina", godina.trim());
      fd.append("format", "zip");
      const res = await fetch("/api/zaduzenja/generate", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Izrada ZIP-a nije uspjela.");
        return;
      }
      triggerDownload(await res.blob(), `Odluke-${asciiSlug(parsed?.school.naziv ?? "skola")}.zip`);
    } catch {
      setError("Došlo je do greške pri izradi ZIP-a.");
    } finally {
      setZipBusy(false);
    }
  }

  function reset() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setFile(null);
    setParsed(null);
    setError(null);
    setShowList(false);
    setStep("upload");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-2 p-5 sm:p-8">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-gold">
        Dokumenti
      </p>
      <h1 className="font-serif text-[1.9rem] font-semibold leading-tight tracking-tight text-ink">
        Odluke o zaduženjima
      </h1>
      <p className="mb-6 text-sm leading-relaxed text-muted">
        Učitajte ispunjenu ministarsku tablicu zaduženja — aplikacija će za svakog
        učitelja izraditi gotovu Odluku o godišnjim i tjednim zaduženjima, spremnu
        za ispis i potpis.
      </p>

      <Stepper current={step} />

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-bad-weak px-4 py-3 text-sm text-bad">
          {error}
        </p>
      ) : null}

      {/* STEP 1 — upload */}
      {step === "upload" ? (
        <div className="flex flex-col gap-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileInput.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-bg-tint px-6 py-12 text-center transition-colors hover:border-accent hover:bg-accent-weak"
          >
            <span className="text-4xl">📄</span>
            {busy ? (
              <p className="text-base font-medium text-ink">Čitam tablicu…</p>
            ) : (
              <>
                <p className="text-base font-medium text-ink">
                  Kliknite ovdje i odaberite ispunjenu tablicu
                </p>
                <p className="text-sm text-muted">
                  ili je povucite i ispustite ovamo · Excel datoteka (.xlsx)
                </p>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
          <div className="rounded-xl border border-line bg-surface p-5 text-sm text-ink/80 shadow-[var(--shadow)]">
            <p className="mb-1 font-medium text-ink">Kako to radi:</p>
            <ol className="ml-5 list-decimal space-y-1">
              <li>Učitate ispunjenu tablicu zaduženja (onu koju šaljete ministarstvu).</li>
              <li>Provjerite podatke škole i upišete KLASA/URBROJ.</li>
              <li>Preuzmete gotove Odluke (jedan PDF za ispis ili ZIP po učitelju).</li>
            </ol>
          </div>
        </div>
      ) : null}

      {/* STEP 2 — review + settings */}
      {step === "review" && parsed ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-serif text-lg font-semibold text-ink">{parsed.school.naziv}</p>
                <p className="text-sm text-muted">
                  {parsed.school.mjesto}
                  {parsed.school.ravnatelj ? ` · ravnatelj/ica: ${parsed.school.ravnatelj}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-accent-weak px-3 py-1 text-sm font-semibold text-accent">
                {parsed.teachers.length} učitelja
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowList((v) => !v)}
              className="mt-3 text-sm text-accent underline-offset-2 hover:underline"
            >
              {showList ? "Sakrij popis" : "Prikaži popis učitelja"}
            </button>
            {showList ? (
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line">
                {parsed.teachers.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5 text-sm text-ink last:border-0"
                  >
                    <span className="truncate">
                      <span className="text-faint">{i + 1}.</span> {t.name}
                      <span className="text-muted"> — {t.predmet}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {t.ukupno_tjedno} h
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">KLASA</span>
              <input value={klasa} onChange={(e) => setKlasa(e.target.value)} className={inputCls} />
              <span className="text-xs text-faint">ista za sve Odluke</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">URBROJ (početni)</span>
              <input value={urbrojBase} onChange={(e) => setUrbrojBase(e.target.value)} className={inputCls} />
              <span className="text-xs text-faint">dodaje se -1, -2, -3… po učitelju</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Školska godina</span>
              <input value={godina} onChange={(e) => setGodina(e.target.value)} className={inputCls} />
              <span className="text-xs text-faint">npr. 2026./2027.</span>
            </label>
          </div>

          <p className="text-xs text-faint">
            Datum na Odluci bit će današnji dan. Mjesto i ime ravnatelja/ice uzimaju
            se iz tablice.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-bg-tint"
            >
              ◀ Natrag
            </button>
            <button
              type="button"
              onClick={generate}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
            >
              Generiraj Odluke ({parsed.teachers.length}) ▶
            </button>
          </div>
        </div>
      ) : null}

      {/* STEP 3a — generating */}
      {step === "generating" ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-16 text-center shadow-[var(--shadow)]">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-accent-weak border-t-accent" />
          <p className="text-base font-medium text-ink">
            Generiram {parsed?.teachers.length ?? ""} Odluka…
          </p>
          <p className="text-sm text-muted">Ovo može potrajati nekoliko sekundi.</p>
        </div>
      ) : null}

      {/* STEP 3b — done */}
      {step === "done" ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-good/30 bg-good-weak px-6 py-8 text-center">
            <span className="text-4xl">✅</span>
            <p className="text-base font-semibold text-ink">
              Gotovo! Izrađeno {parsed?.teachers.length ?? ""} Odluka.
            </p>
            <p className="text-sm text-muted">
              Preuzmite i isprintajte. Svaka Odluka je na svojoj stranici.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href={pdfUrl ?? "#"}
              download={pdfName}
              className="flex flex-col items-center gap-1 rounded-xl bg-accent px-5 py-5 text-center text-accent-ink transition-colors hover:bg-accent-hover"
            >
              <span className="text-lg font-semibold">⬇ Preuzmi PDF</span>
              <span className="text-sm text-accent-ink/80">
                svi učitelji u jednom dokumentu — za ispis svih odjednom
              </span>
            </a>
            <button
              type="button"
              onClick={downloadZip}
              disabled={zipBusy}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-accent px-5 py-5 text-center text-accent transition-colors hover:bg-accent-weak disabled:opacity-60"
            >
              <span className="text-lg font-semibold">
                {zipBusy ? "Pripremam ZIP…" : "⬇ Preuzmi ZIP"}
              </span>
              <span className="text-sm text-muted">
                zaseban PDF za svakog učitelja (+ skupni PDF)
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={reset}
            className="self-start text-sm text-accent underline-offset-2 hover:underline"
          >
            ↺ Nova tablica
          </button>
        </div>
      ) : null}
    </main>
  );
}
