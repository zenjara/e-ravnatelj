"use client";

import { useRef, useState, useTransition } from "react";
import { saveTeachers, type TeacherRow } from "./actions";

interface ParsedStaff {
  rows: { prezime: string; ime: string; radno_mjesto: string }[];
  detected: string[];
  droppedOib: boolean;
}

type View = "roster" | "preview";

export function UciteljiClient({
  schoolName,
  initialTeachers,
}: {
  schoolName: string | null;
  initialTeachers: TeacherRow[];
}) {
  const [teachers, setTeachers] = useState<TeacherRow[]>(initialTeachers);
  const [view, setView] = useState<View>("roster");
  const [draft, setDraft] = useState<TeacherRow[]>([]);
  const [detected, setDetected] = useState<string[]>([]);
  const [droppedOib, setDroppedOib] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  if (!schoolName) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <h1 className="text-xl font-semibold tracking-tight">Učitelji</h1>
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Vašem računu još nije dodijeljena škola. Javite se administratoru da
          poveže vaš račun sa školom, pa ćete moći uvesti popis učitelja.
        </p>
      </main>
    );
  }

  async function handleFile(f: File) {
    if (!/\.(xlsx?|csv)$/i.test(f.name)) {
      setError("Datoteka mora biti Excel (.xlsx) ili CSV.");
      return;
    }
    setError(null);
    setSavedNote(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/ucitelji/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Nije moguće pročitati datoteku.");
        return;
      }
      const parsed = data as ParsedStaff;
      setDraft(parsed.rows);
      setDetected(parsed.detected);
      setDroppedOib(parsed.droppedOib);
      setView("preview");
    } catch {
      setError("Došlo je do greške pri čitanju. Pokušajte ponovno.");
    } finally {
      setBusy(false);
    }
  }

  function editRow(i: number, field: keyof TeacherRow, value: string) {
    setDraft((d) => d.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  }
  function removeRow(i: number) {
    setDraft((d) => d.filter((_, j) => j !== i));
  }
  function addRow() {
    setDraft((d) => [...d, { prezime: "", ime: "", radno_mjesto: "" }]);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const { saved } = await saveTeachers(draft);
        setTeachers(
          [...draft]
            .filter((r) => r.prezime || r.ime)
            .sort((a, b) => a.prezime.localeCompare(b.prezime, "hr")),
        );
        setView("roster");
        setSavedNote(`Spremljeno ${saved} učitelja.`);
      } catch (e) {
        setError((e as Error).message || "Spremanje nije uspjelo.");
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-5 sm:p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Učitelji</h1>
        <p className="mt-0.5 text-sm text-black/60 dark:text-white/60">
          {schoolName}
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {savedNote ? (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">
          {savedNote}
        </p>
      ) : null}

      {/* ROSTER */}
      {view === "roster" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-black/70 dark:text-white/70">
              {teachers.length
                ? `Spremljeno ${teachers.length} učitelja.`
                : "Još nema spremljenog popisa učitelja."}
            </p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Čitam…" : teachers.length ? "Zamijeni iz e-Matice" : "＋ Uvezi iz e-Matice"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {teachers.length ? (
            <ul className="divide-y divide-black/5 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
              {teachers.map((t, i) => (
                <li key={t.id ?? i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span>
                    <span className="text-black/35 dark:text-white/35">{i + 1}.</span>{" "}
                    <span className="font-medium">{t.prezime} {t.ime}</span>
                  </span>
                  <span className="text-black/55 dark:text-white/55">{t.radno_mjesto}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-black/10 bg-white p-4 text-sm text-black/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
              <p className="mb-1 font-medium">Kako nabaviti popis:</p>
              <ol className="ml-5 list-decimal space-y-1">
                <li>U e-Matici otvorite <b>Djelatnici → Popis</b>.</li>
                <li>Gore desno odaberite format <b>Excel</b> i preuzmite datoteku.</li>
                <li>Učitajte je ovdje gumbom „Uvezi iz e-Matice”.</li>
              </ol>
              <p className="mt-2 text-xs text-black/45 dark:text-white/45">
                OIB se ne sprema — koriste se samo ime, prezime i radno mjesto.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* PREVIEW / EDIT */}
      {view === "preview" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-black/[0.03] px-4 py-3 text-sm dark:bg-white/[0.04]">
            Pronađeno <b>{draft.length}</b> zaposlenika.{" "}
            {detected.length ? <>Prepoznati stupci: {detected.join(", ")}. </> : null}
            {droppedOib ? "OIB je preskočen (ne sprema se)." : null}
            <span className="block text-black/55 dark:text-white/55">
              Provjerite i ispravite po potrebi, pa spremite.
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                  <th className="px-2 py-2 font-semibold">Prezime</th>
                  <th className="px-2 py-2 font-semibold">Ime</th>
                  <th className="px-2 py-2 font-semibold">Radno mjesto</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {draft.map((r, i) => (
                  <tr key={i} className="border-b border-black/5 last:border-0 dark:border-white/10">
                    <td className="px-1 py-1">
                      <input
                        value={r.prezime}
                        onChange={(e) => editRow(i, "prezime", e.target.value)}
                        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-black/15 focus:border-blue-400 focus:outline-none dark:hover:border-white/20"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={r.ime}
                        onChange={(e) => editRow(i, "ime", e.target.value)}
                        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-black/15 focus:border-blue-400 focus:outline-none dark:hover:border-white/20"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={r.radno_mjesto}
                        onChange={(e) => editRow(i, "radno_mjesto", e.target.value)}
                        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-black/15 focus:border-blue-400 focus:outline-none dark:hover:border-white/20"
                      />
                    </td>
                    <td className="px-1 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        title="Ukloni"
                        className="px-1.5 text-black/30 hover:text-red-500 dark:text-white/30"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="self-start text-sm text-blue-700 hover:underline dark:text-blue-300"
          >
            ＋ Dodaj retka
          </button>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => { setView("roster"); setError(null); }}
              className="rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Odustani
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Spremam…" : `Spremi ${draft.filter((r) => r.prezime || r.ime).length} učitelja`}
            </button>
          </div>
          <p className="text-xs text-black/45 dark:text-white/45">
            Spremanje zamjenjuje postojeći popis ove škole.
          </p>
        </div>
      ) : null}
    </main>
  );
}
