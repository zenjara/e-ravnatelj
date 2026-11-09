"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { saveTeachers, updateTeacherZvanje, type TeacherRow } from "./actions";
import type { GoSnapshot } from "../godisnji-odmori/actions";
import { PdfPreview, fetchGoPdf, downloadBlob } from "../godisnji-odmori/pdf-preview";
import { parseStaz, formatStaz } from "@/lib/ucitelji/staz";

interface ParsedStaff {
  rows: TeacherRow[];
  detected: string[];
  droppedOib: boolean;
}

type View = "roster" | "preview";

const stazLabel = (raw: number | null | undefined) =>
  raw == null ? "—" : formatStaz(parseStaz(String(raw)));

export function UciteljiClient({
  schoolName,
  initialTeachers,
  latestGo,
}: {
  schoolName: string | null;
  initialTeachers: TeacherRow[];
  latestGo: Record<string, GoSnapshot>;
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
  const zvanjeFocus = useRef<string>("");
  // Inline GO PDF preview (jedan modal; generira se iz zadnjeg spremljenog snapshota).
  const [goPreview, setGoPreview] = useState<{ url: string; title: string; filename: string } | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  async function previewGo(t: TeacherRow, snap: GoSnapshot) {
    if (!t.id) return;
    setError(null);
    setPreviewingId(t.id);
    try {
      const godina = String(snap.godina);
      const blob = await fetchGoPdf({
        ime: t.ime,
        prezime: t.prezime,
        zvanje: t.radno_mjesto,
        staz_ukupno: t.staz_ukupno,
        kategorija: snap.kategorija ?? "ostali",
        uvjeti: snap.go_uvjeti ?? {},
        socijalni: snap.go_socijalni ?? {},
        rezultati: snap.go_rezultati ?? null,
        klasa: snap.klasa,
        urbroj: snap.urbroj,
        godina,
      });
      setGoPreview((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return {
          url: URL.createObjectURL(blob),
          title: `Rješenje — ${t.prezime} ${t.ime} · ${godina}`,
          filename: `Rjesenje-GO-${t.prezime}-${t.ime}-${godina}.pdf`,
        };
      });
    } catch (e) {
      setError((e as Error).message || "Pregled nije uspio.");
    } finally {
      setPreviewingId(null);
    }
  }

  function closeGoPreview() {
    setGoPreview((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
  }

  function editZvanjeLocal(i: number, value: string) {
    setTeachers((ts) => ts.map((x, j) => (j === i ? { ...x, radno_mjesto: value } : x)));
  }
  function saveZvanje(i: number, teacherId: string | undefined, value: string) {
    if (!teacherId || value === zvanjeFocus.current) return;
    startTransition(async () => {
      try {
        const { kategorija } = await updateTeacherZvanje(teacherId, value);
        setTeachers((ts) => ts.map((x, j) => (j === i ? { ...x, radno_mjesto: value.trim(), kategorija } : x)));
      } catch (e) {
        setError((e as Error).message || "Spremanje zvanja nije uspjelo.");
      }
    });
  }

  if (!schoolName) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 p-5 sm:p-8">
        <h1 className="font-serif text-[1.9rem] font-semibold tracking-tight text-ink">Učitelji</h1>
        <p className="mt-4 rounded-lg bg-warn-weak px-4 py-3 text-sm text-warn-ink">
          Vašem računu još nije dodijeljena škola. Javite se administratoru da poveže vaš račun sa
          školom, pa ćete moći uvesti popis učitelja.
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
    setDraft((d) =>
      d.map((r, j) => {
        if (j !== i) return r;
        if (field === "staz_ukupno" || field === "staz_obrazovni") {
          const digits = value.replace(/\D/g, "");
          return { ...r, [field]: digits === "" ? null : Number(digits) };
        }
        return { ...r, [field]: value };
      }),
    );
  }
  function removeRow(i: number) {
    setDraft((d) => d.filter((_, j) => j !== i));
  }
  function addRow() {
    setDraft((d) => [
      ...d,
      { prezime: "", ime: "", radno_mjesto: "", staz_ukupno: null, staz_obrazovni: null },
    ]);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const { saved, teachers: savedRows } = await saveTeachers(draft);
        setTeachers(savedRows); // rows from DB, with ids — GO/zvanje editable at once
        setView("roster");
        setSavedNote(`Spremljeno ${saved} djelatnika.`);
      } catch (e) {
        setError((e as Error).message || "Spremanje nije uspjelo.");
      }
    });
  }

  const inputCls =
    "w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-ink transition-colors hover:border-line focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 pt-5 pb-28 sm:px-8 sm:pt-8">
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-gold">{schoolName}</p>
        <h1 className="font-serif text-[1.9rem] font-semibold leading-tight tracking-tight text-ink">
          Učitelji
        </h1>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-bad-weak px-4 py-3 text-sm text-bad">{error}</p>
      ) : null}
      {savedNote ? (
        <p className="rounded-lg bg-good-weak px-4 py-3 text-sm text-good">{savedNote}</p>
      ) : null}

      {/* ROSTER */}
      {view === "roster" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {teachers.length
                ? `Spremljeno ${teachers.length} djelatnika.`
                : "Još nema spremljenog popisa djelatnika."}
            </p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
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
            <>
              <p className="text-xs text-faint">
                Baza djelatnika škole. Uz svakog vidite i brzo otvarate njegov godišnji odmor i
                zaduženja.
              </p>

              <div className="flex flex-col gap-3">
                {teachers.map((t, i) => {
                  const id = t.id ?? String(i);
                  const snap = t.id ? latestGo[t.id] : undefined;
                  return (
                    <div
                      key={id}
                      className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-faint tabular-nums">{i + 1}.</span>
                        <h3 className="font-medium text-ink">{t.prezime} {t.ime}</h3>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="text-[0.68rem] uppercase tracking-wide text-faint">Zvanje</label>
                        <input
                          value={t.radno_mjesto}
                          placeholder="＋ dodaj…"
                          disabled={!t.id}
                          onFocus={(e) => { zvanjeFocus.current = e.target.value; }}
                          onChange={(e) => editZvanjeLocal(i, e.target.value)}
                          onBlur={(e) => saveZvanje(i, t.id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                          title="Zvanje — klikni za uređivanje"
                          className="w-56 max-w-full rounded-md border border-line bg-bg px-2 py-1 text-xs text-ink transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
                        />
                        <span className="shrink-0 rounded bg-bg-tint px-1.5 py-0.5 text-[0.68rem] tabular-nums text-muted">
                          staž {stazLabel(t.staz_ukupno)}
                        </span>
                      </div>

                      {/* Footer: brzi pristup rješenjima za ovog djelatnika. */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        {snap && t.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => previewGo(t, snap)}
                              disabled={previewingId === t.id}
                              title={`Pregledaj rješenje o godišnjem odmoru (${snap.godina})`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:bg-accent-weak disabled:opacity-50"
                            >
                              <span aria-hidden>🏖️</span>
                              {previewingId === t.id ? "Pripremam…" : "Pregledaj GO"}
                              <span className="rounded bg-good-weak px-1 text-[0.62rem] font-semibold text-good tabular-nums">
                                {snap.godina}
                                {snap.ukupno_dana != null ? ` · ${snap.ukupno_dana} d` : ""}
                              </span>
                            </button>
                            <Link
                              href={`/app/godisnji-odmori#${t.id}`}
                              title="Uredi godišnji odmor"
                              className="text-xs text-muted underline-offset-2 hover:text-accent hover:underline"
                            >
                              uredi
                            </Link>
                          </>
                        ) : t.id ? (
                          <Link
                            href={`/app/godisnji-odmori#${t.id}`}
                            title="Godišnji odmor — izradi rješenje"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:bg-accent-weak"
                          >
                            <span aria-hidden>🏖️</span>
                            Godišnji odmor
                            <span className="rounded bg-bg-tint px-1 text-[0.62rem] font-semibold text-faint">—</span>
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-faint">
                            <span aria-hidden>🏖️</span>
                            Godišnji odmor
                          </span>
                        )}
                        <Link
                          href="/app/zaduzenja"
                          title="Zaduženja — izrada Odluke"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:bg-accent-weak"
                        >
                          <span aria-hidden>📄</span>
                          Zaduženje
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-line bg-surface p-5 text-sm text-ink/80 shadow-[var(--shadow)]">
              <p className="mb-1 font-medium text-ink">Kako nabaviti popis:</p>
              <ol className="ml-5 list-decimal space-y-1">
                <li>U e-Matici otvorite <b>Djelatnici → Popis</b>.</li>
                <li>Gore desno odaberite format <b>Excel</b> i preuzmite datoteku.</li>
                <li>Učitajte je ovdje gumbom „Uvezi iz e-Matice”.</li>
              </ol>
              <p className="mt-2 text-xs text-faint">
                OIB se ne sprema — koriste se ime, prezime, zvanje i radni staž (za godišnji odmor).
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* PREVIEW / EDIT */}
      {view === "preview" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-bg-tint px-4 py-3 text-sm text-ink">
            Pronađeno <b>{draft.length}</b> zaposlenika.{" "}
            {detected.length ? <>Prepoznati stupci: {detected.join(", ")}. </> : null}
            {droppedOib ? "OIB je preskočen (ne sprema se)." : null}
            <span className="block text-muted">Provjerite i ispravite po potrebi, pa spremite.</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-faint">
                  <th className="px-3 py-2.5 font-semibold">Prezime</th>
                  <th className="px-3 py-2.5 font-semibold">Ime</th>
                  <th className="px-3 py-2.5 font-semibold">Zvanje</th>
                  <th className="px-3 py-2.5 font-semibold" title="Radno iskustvo ukupno (e-Matica)">Staž uk.</th>
                  <th className="px-3 py-2.5 font-semibold" title="Radno iskustvo u obrazovanju">Staž obr.</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {draft.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-1.5 py-1">
                      <input value={r.prezime} onChange={(e) => editRow(i, "prezime", e.target.value)} className={inputCls} />
                    </td>
                    <td className="px-1.5 py-1">
                      <input value={r.ime} onChange={(e) => editRow(i, "ime", e.target.value)} className={inputCls} />
                    </td>
                    <td className="px-1.5 py-1">
                      <input value={r.radno_mjesto} onChange={(e) => editRow(i, "radno_mjesto", e.target.value)} className={inputCls} />
                    </td>
                    <td className="px-1.5 py-1 w-28">
                      <input
                        value={r.staz_ukupno ?? ""}
                        onChange={(e) => editRow(i, "staz_ukupno", e.target.value)}
                        inputMode="numeric"
                        className={`${inputCls} tabular-nums`}
                        title={`→ ${stazLabel(r.staz_ukupno)}`}
                      />
                      <span className="block px-2 text-[0.68rem] text-faint">{stazLabel(r.staz_ukupno)}</span>
                    </td>
                    <td className="px-1.5 py-1 w-28">
                      <input
                        value={r.staz_obrazovni ?? ""}
                        onChange={(e) => editRow(i, "staz_obrazovni", e.target.value)}
                        inputMode="numeric"
                        className={`${inputCls} tabular-nums`}
                        title={`→ ${stazLabel(r.staz_obrazovni)}`}
                      />
                      <span className="block px-2 text-[0.68rem] text-faint">{stazLabel(r.staz_obrazovni)}</span>
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        title="Ukloni"
                        className="px-1.5 text-faint transition-colors hover:text-bad"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addRow} className="self-start text-sm text-accent underline-offset-2 hover:underline">
            ＋ Dodaj retka
          </button>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => { setView("roster"); setError(null); }}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-bg-tint"
            >
              Odustani
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Spremam…" : `Spremi ${draft.filter((r) => r.prezime || r.ime).length} djelatnika`}
            </button>
          </div>
          <p className="text-xs text-faint">Spremanje zamjenjuje postojeći popis ove škole.</p>
        </div>
      ) : null}

      {goPreview ? (
        <PdfPreview
          url={goPreview.url}
          title={goPreview.title}
          onDownload={async () => {
            const res = await fetch(goPreview.url);
            downloadBlob(await res.blob(), goPreview.filename);
          }}
          onClose={closeGoPreview}
        />
      ) : null}
    </main>
  );
}
