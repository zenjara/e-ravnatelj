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

const STEPS: [Step, string][] = [
  ["upload", "Učitavanje tablice"],
  ["review", "Provjera i postavke"],
  ["done", "Preuzimanje"],
];

function Stepper({ current }: { current: Step }) {
  const idx = current === "generating" ? 2 : STEPS.findIndex(([s]) => s === current);
  return (
    <ol className="mb-6 flex flex-wrap gap-2">
      {STEPS.map(([s, label], i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                active
                  ? "bg-blue-600 text-white"
                  : done
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                    : "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`text-sm ${active ? "font-semibold" : "text-black/55 dark:text-white/55"}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="mx-1 hidden text-black/20 sm:inline dark:text-white/20">———</span>
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
      <h1 className="text-xl font-semibold tracking-tight">Odluke o zaduženjima</h1>
      <p className="mb-5 text-sm text-black/60 dark:text-white/60">
        Učitajte ispunjenu ministarsku tablicu zaduženja — aplikacija će za svakog
        učitelja izraditi gotovu Odluku o godišnjim i tjednim zaduženjima, spremnu
        za ispis i potpis.
      </p>

      <Stepper current={step} />

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
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
            className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-black/15 bg-black/[0.015] px-6 py-12 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-white/15 dark:bg-white/[0.02] dark:hover:bg-blue-500/5"
          >
            <span className="text-4xl">📄</span>
            {busy ? (
              <p className="text-base font-medium">Čitam tablicu…</p>
            ) : (
              <>
                <p className="text-base font-medium">
                  Kliknite ovdje i odaberite ispunjenu tablicu
                </p>
                <p className="text-sm text-black/50 dark:text-white/50">
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
          <div className="rounded-xl border border-black/10 bg-white p-4 text-sm text-black/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
            <p className="mb-1 font-medium">Kako to radi:</p>
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
          <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{parsed.school.naziv}</p>
                <p className="text-sm text-black/55 dark:text-white/55">
                  {parsed.school.mjesto}
                  {parsed.school.ravnatelj ? ` · ravnatelj/ica: ${parsed.school.ravnatelj}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                {parsed.teachers.length} učitelja
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowList((v) => !v)}
              className="mt-3 text-sm text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
            >
              {showList ? "Sakrij popis" : "Prikaži popis učitelja"}
            </button>
            {showList ? (
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-black/5 dark:border-white/10">
                {parsed.teachers.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 border-b border-black/5 px-3 py-1.5 text-sm last:border-0 dark:border-white/10"
                  >
                    <span className="truncate">
                      <span className="text-black/40 dark:text-white/40">{i + 1}.</span>{" "}
                      {t.name}
                      <span className="text-black/45 dark:text-white/45"> — {t.predmet}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-black/55 dark:text-white/55">
                      {t.ukupno_tjedno} h
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">KLASA</span>
              <input
                value={klasa}
                onChange={(e) => setKlasa(e.target.value)}
                className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5"
              />
              <span className="text-xs text-black/45 dark:text-white/45">ista za sve Odluke</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">URBROJ (početni)</span>
              <input
                value={urbrojBase}
                onChange={(e) => setUrbrojBase(e.target.value)}
                className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5"
              />
              <span className="text-xs text-black/45 dark:text-white/45">
                dodaje se -1, -2, -3… po učitelju
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Školska godina</span>
              <input
                value={godina}
                onChange={(e) => setGodina(e.target.value)}
                className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5"
              />
              <span className="text-xs text-black/45 dark:text-white/45">npr. 2026./2027.</span>
            </label>
          </div>

          <p className="text-xs text-black/45 dark:text-white/45">
            Datum na Odluci bit će današnji dan. Mjesto i ime ravnatelja/ice uzimaju
            se iz tablice.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              ◀ Natrag
            </button>
            <button
              type="button"
              onClick={generate}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Generiraj Odluke ({parsed.teachers.length}) ▶
            </button>
          </div>
        </div>
      ) : null}

      {/* STEP 3a — generating */}
      {step === "generating" ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-black/10 bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.03]">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-base font-medium">
            Generiram {parsed?.teachers.length ?? ""} Odluka…
          </p>
          <p className="text-sm text-black/50 dark:text-white/50">
            Ovo može potrajati nekoliko sekundi.
          </p>
        </div>
      ) : null}

      {/* STEP 3b — done */}
      {step === "done" ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-6 py-8 text-center dark:border-green-500/30 dark:bg-green-950/30">
            <span className="text-4xl">✅</span>
            <p className="text-base font-semibold">
              Gotovo! Izrađeno {parsed?.teachers.length ?? ""} Odluka.
            </p>
            <p className="text-sm text-black/55 dark:text-white/55">
              Preuzmite i isprintajte. Svaka Odluka je na svojoj stranici.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href={pdfUrl ?? "#"}
              download={pdfName}
              className="flex flex-col items-center gap-1 rounded-xl bg-blue-600 px-5 py-5 text-center text-white transition-opacity hover:opacity-90"
            >
              <span className="text-lg font-semibold">⬇ Preuzmi PDF</span>
              <span className="text-sm text-blue-100">
                svi učitelji u jednom dokumentu — za ispis svih odjednom
              </span>
            </a>
            <button
              type="button"
              onClick={downloadZip}
              disabled={zipBusy}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-blue-600 px-5 py-5 text-center text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60 dark:text-blue-300 dark:hover:bg-blue-500/10"
            >
              <span className="text-lg font-semibold">
                {zipBusy ? "Pripremam ZIP…" : "⬇ Preuzmi ZIP"}
              </span>
              <span className="text-sm text-black/50 dark:text-white/50">
                zaseban PDF za svakog učitelja (+ skupni PDF)
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={reset}
            className="self-start text-sm text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
          >
            ↺ Nova tablica
          </button>
        </div>
      ) : null}
    </main>
  );
}
