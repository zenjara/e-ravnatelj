"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type TeacherRow, type GoUvjeti, type GoSocijalni } from "../ucitelji/actions";
import {
  getGoSnapshotsForYear,
  listGoYears,
  saveGoYear,
  type GoSnapshot,
  type GoYearEntry,
} from "./actions";
import { PdfPreview, fetchGoPdf, downloadBlob } from "./pdf-preview";
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

const KATEGORIJE: Kategorija[] = ["I", "II", "III", "ostali"];
const UVJET_KEYS: UvjetKey[] = [
  "posebni_uvjeti", "smjenski", "rad_s_teskocama", "razrednik", "vise_predmeta", "dvije_skole",
];

const stazLabel = (raw: number | null | undefined) =>
  raw == null ? "—" : formatStaz(parseStaz(String(raw)));

export function GodisnjiOdmoriClient({
  schoolName,
  initialTeachers,
}: {
  schoolName: string | null;
  initialTeachers: TeacherRow[];
}) {
  const [teachers] = useState<TeacherRow[]>(initialTeachers);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Zaglavlje rješenja — dijeli se za sve, pamti se u sesiji stranice.
  const [cfg, setCfg] = useState({ klasa: "", urbroj: "", godina: String(new Date().getFullYear()) });
  // Per-year snapshots for the selected godina, + light history across all years.
  const [snapshots, setSnapshots] = useState<Record<string, GoSnapshot>>({});
  const [years, setYears] = useState<Record<string, GoYearEntry[]>>({});

  const godinaNum = Number(cfg.godina);
  const godinaValid = /^\d{4}$/.test(cfg.godina);

  const reloadSnapshots = useCallback(async (godina: number) => {
    const map = await getGoSnapshotsForYear(godina);
    setSnapshots(map);
  }, []);

  // Load snapshots for the active year (and whenever it changes).
  useEffect(() => {
    if (godinaValid) reloadSnapshots(godinaNum);
  }, [godinaNum, godinaValid, reloadSnapshots]);

  // Light history (all years) once — refreshed after each save.
  const reloadYears = useCallback(async () => setYears(await listGoYears()), []);
  useEffect(() => {
    reloadYears();
  }, [reloadYears]);

  // Deep-link iz baze ("Učitelji"): /app/godisnji-odmori#<id> otvori tog djelatnika.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (id && teachers.some((t) => t.id === id)) {
      setOpen(id);
      requestAnimationFrame(() => {
        document.getElementById(`go-${id}`)?.scrollIntoView({ block: "center" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) =>
      `${t.prezime} ${t.ime} ${t.radno_mjesto}`.toLowerCase().includes(q),
    );
  }, [teachers, query]);

  const spremljeno = teachers.filter((t) => t.id && snapshots[t.id]).length;

  const onSaved = useCallback(
    (teacherId: string, snap: GoSnapshot) => {
      setSnapshots((m) => ({ ...m, [teacherId]: snap }));
      reloadYears();
    },
    [reloadYears],
  );

  if (!schoolName) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 p-5 sm:p-8">
        <h1 className="font-serif text-[1.9rem] font-semibold tracking-tight text-ink">Godišnji odmori</h1>
        <p className="mt-4 rounded-lg bg-warn-weak px-4 py-3 text-sm text-warn-ink">
          Vašem računu još nije dodijeljena škola. Javite se administratoru da poveže vaš račun sa
          školom.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 pt-5 pb-28 sm:px-8 sm:pt-8">
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-gold">{schoolName}</p>
        <h1 className="font-serif text-[1.9rem] font-semibold leading-tight tracking-tight text-ink">
          Godišnji odmori
        </h1>
        <p className="mt-1 text-sm text-muted">
          Izrada i arhiva Rješenja o godišnjem odmoru po godinama, na temelju popisa iz{" "}
          <Link href="/app/ucitelji" className="text-accent underline-offset-2 hover:underline">
            Učitelja
          </Link>
          .
        </p>
      </div>

      {teachers.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-5 text-sm text-ink/80 shadow-[var(--shadow)]">
          <p className="mb-1 font-medium text-ink">Nema spremljenog popisa djelatnika.</p>
          <p className="text-muted">
            Najprije uvezite popis iz e-Matice u sekciji{" "}
            <Link href="/app/ucitelji" className="font-medium text-accent underline-offset-2 hover:underline">
              Učitelji
            </Link>
            , pa se ovdje za svakog može izraditi rješenje.
          </p>
        </div>
      ) : (
        <>
          {/* Zaglavlje rješenja + godina (odabir godine mijenja aktivnu bazu). */}
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
                  onChange={(e) => setCfg((c) => ({ ...c, godina: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  inputMode="numeric"
                  className="w-full rounded-md border border-line bg-bg px-2.5 py-1.5 tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {teachers.length} djelatnika · spremljeno za{" "}
              <span className="font-medium text-ink tabular-nums">{cfg.godina}</span>:{" "}
              <span className="font-medium text-ink">{spremljeno}</span>
            </p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pretraži po imenu ili zvanju…"
              className="w-full max-w-xs rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink shadow-[var(--shadow)] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
            <ul className="divide-y divide-line">
              {filtered.map((t) => {
                const id = t.id ?? "";
                const isOpen = open === id;
                const snap = id ? snapshots[id] : undefined;
                const hist = (id ? years[id] : undefined) ?? [];
                const otherYears = hist.filter((y) => y.godina !== godinaNum);
                return (
                  <li key={id} id={`go-${id}`}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : id)}
                      aria-expanded={isOpen}
                      className="flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-bg-tint/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-ink">{t.prezime} {t.ime}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          {t.radno_mjesto ? (
                            <span className="text-xs text-muted">{t.radno_mjesto}</span>
                          ) : (
                            <span className="text-xs text-faint italic">bez zvanja</span>
                          )}
                          <span className="shrink-0 rounded bg-bg-tint px-1.5 py-0.5 text-[0.68rem] tabular-nums text-muted">
                            staž {stazLabel(t.staz_ukupno)}
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[0.68rem] font-medium ${
                              snap ? "bg-good-weak text-good" : "bg-bg-tint text-faint"
                            }`}
                          >
                            {snap
                              ? `${cfg.godina}: ${snap.ukupno_dana ?? "—"} dana`
                              : "nije postavljeno"}
                          </span>
                          {otherYears.length ? (
                            <span className="shrink-0 text-[0.66rem] text-faint">
                              ostalo: {otherYears.map((y) => y.godina).join(", ")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`mt-0.5 shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          isOpen ? "bg-accent text-accent-ink" : "border border-line text-ink"
                        }`}
                      >
                        {isOpen ? "Zatvori" : "Rješenje"}
                      </span>
                    </button>
                    {isOpen ? (
                      <GoPanel
                        key={`${id}-${cfg.godina}`}
                        teacher={t}
                        cfg={cfg}
                        snapshot={snap}
                        years={hist}
                        onSaved={(snapshot) => id && onSaved(id, snapshot)}
                        onSwitchYear={(g) => setCfg((c) => ({ ...c, godina: String(g) }))}
                      />
                    ) : null}
                  </li>
                );
              })}
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-faint">Nema rezultata za „{query}”.</li>
              ) : null}
            </ul>
          </div>
        </>
      )}
    </main>
  );
}

/**
 * Per-employee annual-leave panel for one year: criteria → live total → save
 * (per godina) / preview / download PDF. Remounted (via key) when the teacher or
 * year changes, so it always initializes from that year's snapshot.
 */
function GoPanel({
  teacher,
  cfg,
  snapshot,
  years,
  onSaved,
  onSwitchYear,
}: {
  teacher: TeacherRow;
  cfg: { klasa: string; urbroj: string; godina: string };
  snapshot?: GoSnapshot;
  years: GoYearEntry[];
  onSaved: (snap: GoSnapshot) => void;
  onSwitchYear: (godina: number) => void;
}) {
  // Init order: this year's snapshot → teacher's last-saved (latest) → defaults.
  const base = snapshot ?? {
    kategorija: teacher.kategorija ?? null,
    go_uvjeti: teacher.go_uvjeti ?? {},
    go_socijalni: teacher.go_socijalni ?? {},
    go_rezultati: teacher.go_rezultati ?? null,
  };
  const soc = base.go_socijalni ?? {};

  const [kategorija, setKategorija] = useState<Kategorija>(
    base.kategorija ?? procijeniKategoriju(teacher.radno_mjesto),
  );
  const [uvjeti, setUvjeti] = useState<GoUvjeti>(base.go_uvjeti ?? {});
  const [brojDjece, setBrojDjece] = useState(soc.brojDjece ?? 0);
  const [djecaSTeskocama, setDjecaSTeskocama] = useState(soc.djecaSTeskocama ?? 0);
  const [invaliditet, setInvaliditet] = useState(!!soc.invaliditet);
  const [samohrani, setSamohrani] = useState(!!soc.samohrani);
  const [domovinskiRat, setDomovinskiRat] = useState(!!soc.domovinskiRat);
  const [rezultati, setRezultati] = useState<Rezultati>(base.go_rezultati ?? null);
  const [savingGo, setSavingGo] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  const socijalni: GoSocijalni = { brojDjece, djecaSTeskocama, invaliditet, samohrani, domovinskiRat };

  async function spremiKriterije() {
    if (!teacher.id) return;
    setErr(null);
    setSavingGo(true);
    try {
      const snap = await saveGoYear({
        teacherId: teacher.id,
        godina: Number(cfg.godina),
        kategorija,
        uvjeti,
        socijalni,
        rezultati,
        ukupnoDana: rezultat.ukupno,
        klasa: cfg.klasa,
        urbroj: cfg.urbroj,
      });
      onSaved(snap);
      setNote(`Spremljeno za ${cfg.godina}.`);
    } catch (e) {
      setErr((e as Error).message || "Spremanje nije uspjelo.");
    } finally {
      setSavingGo(false);
    }
  }

  const goInput = () => ({
    ime: teacher.ime,
    prezime: teacher.prezime,
    zvanje: teacher.radno_mjesto,
    staz_ukupno: teacher.staz_ukupno,
    kategorija,
    uvjeti,
    socijalni,
    rezultati,
    klasa: cfg.klasa,
    urbroj: cfg.urbroj,
    godina: cfg.godina,
  });

  async function pregledaj() {
    setErr(null);
    setPreviewing(true);
    try {
      const blob = await fetchGoPdf(goInput());
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setErr((e as Error).message || "Pregled nije uspio.");
    } finally {
      setPreviewing(false);
    }
  }

  function closePreview() {
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  async function preuzmiRjesenje() {
    setErr(null);
    setDownloading(true);
    try {
      const blob = await fetchGoPdf(goInput());
      downloadBlob(blob, `Rjesenje-GO-${teacher.prezime}-${teacher.ime}-${cfg.godina}.pdf`);
    } catch (e) {
      setErr((e as Error).message || "Došlo je do greške. Pokušajte ponovno.");
    } finally {
      setDownloading(false);
    }
  }

  const fieldCls =
    "rounded-md border border-line bg-bg px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

  return (
    <div className="border-t border-line bg-bg-tint/40 px-4 py-4">
      {/* Spremljene godine (arhiva) + oznaka aktivne godine. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-faint">Godina</span>
        <span className="rounded-md bg-accent px-2 py-0.5 font-semibold text-accent-ink tabular-nums">
          {cfg.godina}
        </span>
        {years.length ? (
          <>
            <span className="text-faint">· spremljeno:</span>
            {years
              .slice()
              .sort((a, b) => b.godina - a.godina)
              .map((y) => {
                const active = String(y.godina) === cfg.godina;
                return (
                  <button
                    key={y.godina}
                    type="button"
                    onClick={() => onSwitchYear(y.godina)}
                    className={`rounded-md border px-1.5 py-0.5 tabular-nums transition-colors ${
                      active
                        ? "border-accent bg-accent-weak text-accent"
                        : "border-line text-muted hover:border-accent hover:text-accent"
                    }`}
                    title={`${y.godina} — ${y.ukupno_dana ?? "—"} dana`}
                  >
                    {y.godina}
                  </button>
                );
              })}
          </>
        ) : (
          <span className="text-faint">· još nema spremljenih godina</span>
        )}
      </div>

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
          {savingGo ? "Spremam…" : `Spremi za ${cfg.godina}`}
        </button>
        <button
          type="button"
          onClick={pregledaj}
          disabled={previewing}
          className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-bg-tint disabled:opacity-50"
        >
          {previewing ? "Pripremam…" : "Pregledaj"}
        </button>
        <button
          type="button"
          onClick={preuzmiRjesenje}
          disabled={downloading}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {downloading ? "Generiram…" : "Preuzmi (PDF)"}
        </button>
      </div>

      {previewUrl ? (
        <PdfPreview
          url={previewUrl}
          title={`Rješenje — ${teacher.prezime} ${teacher.ime} · ${cfg.godina}`}
          onDownload={preuzmiRjesenje}
          onClose={closePreview}
        />
      ) : null}
    </div>
  );
}
