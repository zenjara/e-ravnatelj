"use client";

import { useRef, useState, useTransition } from "react";
import { saveTeachers, updateTeacherGo, updateTeacherZvanje, type TeacherRow, type GoUvjeti, type GoSocijalni } from "./actions";
import { parseStaz, formatStaz } from "@/lib/ucitelji/staz";
import {
  izracunajGodisnji,
  procijeniKategoriju,
  KATEGORIJA_LABEL,
  UVJET_LABEL,
  type Kategorija,
  type Rezultati,
  type UvjetKey,
} from "@/lib/ucitelji/godisnji-odmor";

interface ParsedStaff {
  rows: TeacherRow[];
  detected: string[];
  droppedOib: boolean;
}

type View = "roster" | "preview";

const KATEGORIJE: Kategorija[] = ["I", "II", "III", "ostali"];
const UVJET_KEYS: UvjetKey[] = [
  "posebni_uvjeti", "smjenski", "rad_s_teskocama", "razrednik", "vise_predmeta", "dvije_skole",
];

const stazLabel = (raw: number | null | undefined) =>
  raw == null ? "—" : formatStaz(parseStaz(String(raw)));

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
  const [openGo, setOpenGo] = useState<string | null>(null);
  // Zaglavlje rješenja (dijeli se za sve, pamti se u sesiji stranice).
  const [cfg, setCfg] = useState({ klasa: "", urbroj: "", godina: String(new Date().getFullYear()) });
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const zvanjeFocus = useRef<string>("");

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
              {/* Zaglavlje rješenja */}
              <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-faint">
                  Zaglavlje rješenja
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-muted">KLASA</span>
                    <input
                      value={cfg.klasa}
                      onChange={(e) => setCfg((c) => ({ ...c, klasa: e.target.value }))}
                      placeholder="npr. 100-01/26-01/01"
                      className="w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-muted">URBROJ</span>
                    <input
                      value={cfg.urbroj}
                      onChange={(e) => setCfg((c) => ({ ...c, urbroj: e.target.value }))}
                      placeholder="npr. 2181-xxx-01-26-01"
                      className="w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-muted">Godina</span>
                    <input
                      value={cfg.godina}
                      onChange={(e) => setCfg((c) => ({ ...c, godina: e.target.value }))}
                      className="w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
                    />
                  </label>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
                <ul className="divide-y divide-line">
                  {teachers.map((t, i) => {
                    const id = t.id ?? String(i);
                    const isOpen = openGo === id;
                    return (
                      <li key={id}>
                        <div className="flex items-start gap-3 px-4 py-2.5 text-sm">
                          <span className="pt-1 text-faint tabular-nums">{i + 1}.</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-ink">{t.prezime} {t.ime}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              <input
                                value={t.radno_mjesto}
                                placeholder="＋ dodaj zvanje…"
                                disabled={!t.id}
                                onFocus={(e) => { zvanjeFocus.current = e.target.value; }}
                                onChange={(e) => editZvanjeLocal(i, e.target.value)}
                                onBlur={(e) => saveZvanje(i, t.id, e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                title="Zvanje — klikni za uređivanje"
                                className="min-w-[8rem] max-w-full flex-1 rounded-md border border-transparent bg-transparent px-2 py-0.5 text-xs text-muted transition-colors placeholder:text-faint hover:border-line focus:border-accent focus:bg-bg focus:text-ink focus:outline-none focus:ring-4 focus:ring-accent/10"
                              />
                              <span className="shrink-0 rounded bg-bg-tint px-1.5 py-0.5 text-[0.68rem] tabular-nums text-muted">
                                staž {stazLabel(t.staz_ukupno)}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOpenGo(isOpen ? null : id)}
                            className={`mt-0.5 shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                              isOpen ? "bg-accent text-accent-ink" : "border border-line text-ink hover:bg-bg-tint"
                            }`}
                          >
                            {isOpen ? "Zatvori" : "Odmor"}
                          </button>
                        </div>
                        {isOpen ? (
                          <GoPanel
                            teacher={t}
                            cfg={cfg}
                            onSaved={(patch) =>
                              setTeachers((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...patch } : x)))
                            }
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
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
    </main>
  );
}

/** Per-employee annual-leave panel: criteria → live total → save / download PDF. */
function GoPanel({
  teacher,
  cfg,
  onSaved,
}: {
  teacher: TeacherRow;
  cfg: { klasa: string; urbroj: string; godina: string };
  onSaved: (patch: Partial<TeacherRow>) => void;
}) {
  const soc = teacher.go_socijalni ?? {};
  const [kategorija, setKategorija] = useState<Kategorija>(
    teacher.kategorija ?? procijeniKategoriju(teacher.radno_mjesto),
  );
  const [uvjeti, setUvjeti] = useState<GoUvjeti>(teacher.go_uvjeti ?? {});
  const [brojDjece, setBrojDjece] = useState(soc.brojDjece ?? 0);
  const [djecaSTeskocama, setDjecaSTeskocama] = useState(soc.djecaSTeskocama ?? 0);
  const [invaliditet, setInvaliditet] = useState(!!soc.invaliditet);
  const [samohrani, setSamohrani] = useState(!!soc.samohrani);
  const [domovinskiRat, setDomovinskiRat] = useState(!!soc.domovinskiRat);
  const [rezultati, setRezultati] = useState<Rezultati>(teacher.go_rezultati ?? null);
  const [savingGo, setSavingGo] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rezultat = izracunajGodisnji({
    staz: parseStaz(teacher.staz_ukupno == null ? "" : String(teacher.staz_ukupno)),
    kategorija,
    uvjeti,
    brojDjece,
    djecaSTeskocama,
    invaliditet,
    samohrani,
    domovinskiRat,
    rezultati,
  });

  async function spremiKriterije() {
    if (!teacher.id) return;
    setErr(null);
    setSavingGo(true);
    const socijalni: GoSocijalni = { brojDjece, djecaSTeskocama, invaliditet, samohrani, domovinskiRat };
    try {
      await updateTeacherGo(teacher.id, kategorija, uvjeti, socijalni, rezultati);
      onSaved({ kategorija, go_uvjeti: uvjeti, go_socijalni: socijalni, go_rezultati: rezultati });
      setNote("Kriteriji spremljeni.");
    } catch (e) {
      setErr((e as Error).message || "Spremanje nije uspjelo.");
    } finally {
      setSavingGo(false);
    }
  }

  async function preuzmiRjesenje() {
    setErr(null);
    setDownloading(true);
    try {
      const res = await fetch("/api/ucitelji/go", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ime: teacher.ime,
          prezime: teacher.prezime,
          zvanje: teacher.radno_mjesto,
          staz_ukupno: teacher.staz_ukupno,
          kategorija,
          uvjeti,
          socijalni: { brojDjece, djecaSTeskocama, invaliditet, samohrani, domovinskiRat },
          rezultati,
          klasa: cfg.klasa,
          urbroj: cfg.urbroj,
          godina: cfg.godina,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => null);
        setErr(e?.error ?? "Generiranje nije uspjelo.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rjesenje-GO-${teacher.prezime}-${teacher.ime}-${cfg.godina}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Došlo je do greške. Pokušajte ponovno.");
    } finally {
      setDownloading(false);
    }
  }

  const fieldCls =
    "rounded-md border border-line bg-bg px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

  return (
    <div className="border-t border-line bg-bg-tint/40 px-4 py-4">
      <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
        {/* Kriteriji */}
        <div className="flex flex-col gap-3.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-faint">Složenost</span>
            <select value={kategorija} onChange={(e) => setKategorija(e.target.value as Kategorija)} className={fieldCls}>
              {KATEGORIJE.map((k) => (
                <option key={k} value={k}>{KATEGORIJA_LABEL[k]}</option>
              ))}
            </select>
            <span className="text-xs text-faint">
              staž: {stazLabel(teacher.staz_ukupno)}
            </span>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">Uvjeti rada</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {UVJET_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!!uvjeti[k]}
                    onChange={(e) => setUvjeti((u) => ({ ...u, [k]: e.target.checked }))}
                    className="accent-[color:var(--accent)]"
                  />
                  {UVJET_LABEL[k]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
              Socijalni uvjeti <span className="font-normal normal-case text-faint">(osjetljivo — čuva se samo na serveru)</span>
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-1.5">
                Malodobne djece
                <input type="number" min={0} max={20} value={brojDjece}
                  onChange={(e) => setBrojDjece(Math.max(0, Number(e.target.value) || 0))}
                  className={`${fieldCls} w-16`} />
              </label>
              <label className="flex items-center gap-1.5">
                Djece s teškoćama
                <input type="number" min={0} max={20} value={djecaSTeskocama}
                  onChange={(e) => setDjecaSTeskocama(Math.max(0, Number(e.target.value) || 0))}
                  className={`${fieldCls} w-16`} />
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={invaliditet} onChange={(e) => setInvaliditet(e.target.checked)} className="accent-[color:var(--accent)]" />
                Invaliditet
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={samohrani} onChange={(e) => setSamohrani(e.target.checked)} className="accent-[color:var(--accent)]" />
                Samohrani roditelj
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={domovinskiRat} onChange={(e) => setDomovinskiRat(e.target.checked)} className="accent-[color:var(--accent)]" />
                Domovinski rat
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-faint">Radni rezultati</span>
            <select
              value={rezultati ?? ""}
              onChange={(e) => setRezultati((e.target.value || null) as Rezultati)}
              className={fieldCls}
            >
              <option value="">— nije ocijenjeno —</option>
              <option value="uspjesni">uspješni (+1)</option>
              <option value="vrlo_uspjesni">vrlo uspješni (+2)</option>
              <option value="izuzetni">izuzetni (+3)</option>
            </select>
          </div>
        </div>

        {/* Rezultat */}
        <div className="rounded-xl border border-line bg-surface p-3.5 text-sm shadow-[var(--shadow)]">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-faint">Ukupno</span>
            <span className="font-serif text-2xl font-semibold text-accent">{rezultat.ukupno}</span>
          </div>
          <ul className="space-y-0.5 text-xs text-muted">
            {rezultat.stavke.map((s, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{s.label}</span>
                <span className="tabular-nums text-ink">+{s.dani}</span>
              </li>
            ))}
          </ul>
          {rezultat.odrezanoMax ? (
            <p className="mt-2 text-[0.68rem] text-gold">Zbroj {rezultat.zbroj} → ograničeno na 30 (KU).</p>
          ) : rezultat.podignutoMin ? (
            <p className="mt-2 text-[0.68rem] text-gold">Zbroj {rezultat.zbroj} → podignuto na zakonskih 20.</p>
          ) : null}
          <p className="mt-1 text-[0.68rem] text-faint">radnih dana</p>
        </div>
      </div>

      {err ? <p className="mt-3 rounded-lg bg-bad-weak px-3 py-2 text-xs text-bad">{err}</p> : null}
      {note ? <p className="mt-3 rounded-lg bg-good-weak px-3 py-2 text-xs text-good">{note}</p> : null}

      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={spremiKriterije}
          disabled={savingGo || !teacher.id}
          className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-bg-tint disabled:opacity-50"
        >
          {savingGo ? "Spremam…" : "Spremi kriterije"}
        </button>
        <button
          type="button"
          onClick={preuzmiRjesenje}
          disabled={downloading}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {downloading ? "Generiram…" : "Preuzmi rješenje (PDF)"}
        </button>
      </div>
    </div>
  );
}
