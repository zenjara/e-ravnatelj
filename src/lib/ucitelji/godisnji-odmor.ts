/**
 * Godišnji odmor — izračun broja radnih dana prema Kolektivnom ugovoru za
 * zaposlenike u osnovnoškolskim ustanovama (NN 39/2017, čl. 26).
 *
 * ⚠️ PROVJERITI: brojke su iz NN 39/2017. Ako je na snazi noviji/izmijenjeni KU,
 * promijeni SAMO konstantu `KU_OS` niže — ostatak logike ostaje isti.
 *
 * Što se auto-računa iz e-Matice: osnovica + staž (stupac J) + okvirna složenost
 * (iz zvanja). Uvjeti rada, socijalni kriteriji i radni rezultati nisu u izvozu
 * pa se unose ručno. Socijalni kriteriji su osobni podaci i NE spremaju se u bazu.
 */

import { stazToYears, type Staz } from "./staz";

export type Kategorija = "I" | "II" | "III" | "ostali";
export type Rezultati = "izuzetni" | "vrlo_uspjesni" | "uspjesni" | null;

export interface GoConfig {
  /** Polazna osnovica (KU). */
  osnovica: number;
  /** Zakonski minimum ukupnog trajanja (Zakon o radu: 4 tjedna). */
  zakonskiMin: number;
  /** Najveći dopušteni ukupni broj dana (KU). */
  maksimum: number;
  /** Dodatak za staž: gornja granica razreda (godine) → dani. Zadnji: Infinity. */
  staz: { doGodina: number; dani: number }[];
  /** Dodatak za složenost poslova / stručnu spremu. */
  slozenost: Record<Kategorija, number>;
  /** Dodaci za uvjete rada (bool kriteriji). */
  uvjeti: Record<UvjetKey, number>;
  /** Dodaci za radne rezultate. */
  rezultati: Record<Exclude<Rezultati, null>, number>;
}

export type UvjetKey =
  | "posebni_uvjeti"
  | "smjenski"
  | "rad_s_teskocama"
  | "razrednik"
  | "vise_predmeta"
  | "dvije_skole";

export const UVJET_LABEL: Record<UvjetKey, string> = {
  posebni_uvjeti: "Posebni uvjeti rada",
  smjenski: "Smjenski / subote, nedjelje, blagdani",
  rad_s_teskocama: "Rad s učenicima s teškoćama",
  razrednik: "Poslovi razrednika",
  vise_predmeta: "Nastava iz više predmeta",
  dvije_skole: "Rad u dvije škole",
};

export const KATEGORIJA_LABEL: Record<Kategorija, string> = {
  I: "I. — visoka (prof./mag./dipl.)",
  II: "II. — viša (prvostupnik)",
  III: "III. — srednja (SSS)",
  ostali: "Ostali (NKV/PKV)",
};

/** Kolektivni ugovor za osnovnoškolske ustanove — NN 39/2017, čl. 26. */
export const KU_OS: GoConfig = {
  osnovica: 18,
  zakonskiMin: 20,
  maksimum: 30,
  staz: [
    { doGodina: 5, dani: 0 },
    { doGodina: 10, dani: 2 },
    { doGodina: 15, dani: 3 },
    { doGodina: 20, dani: 4 },
    { doGodina: 25, dani: 5 },
    { doGodina: 30, dani: 6 },
    { doGodina: 35, dani: 7 },
    { doGodina: Infinity, dani: 8 },
  ],
  slozenost: { I: 4, II: 3, III: 2, ostali: 1 },
  uvjeti: {
    posebni_uvjeti: 2,
    smjenski: 2,
    rad_s_teskocama: 2,
    razrednik: 1,
    vise_predmeta: 1,
    dvije_skole: 1,
  },
  rezultati: { izuzetni: 3, vrlo_uspjesni: 2, uspjesni: 1 },
};

/** Dani za dani staž (u godinama), prema razredima iz KU. */
export function daniZaStaz(godineStaza: number, cfg: GoConfig = KU_OS): number {
  for (const r of cfg.staz) {
    if (godineStaza < r.doGodina) return r.dani;
  }
  return cfg.staz[cfg.staz.length - 1].dani;
}

/** Okvirna procjena kategorije složenosti iz teksta zvanja (uredivo u UI-u). */
export function procijeniKategoriju(zvanje: string): Kategorija {
  const z = zvanje.toLowerCase();
  // Prvo II (prvostupnik) da "stručni prvostupnik" ne padne u I zbog "stručni".
  if (/prvostupnik|\bbacc\b|vi[šs][ae]\s*stru[čc]n/.test(z)) return "II";
  // Visoka sprema / nastavno i stručno osoblje.
  if (/\b(prof|mag|dipl|magistar|magistr|vss)\b|u[čc]itelj|nastavnik|odgojitelj|stru[čc]ni suradnik|pedagog|psiholog|logoped|defektolog|rehabilitat|ravnatelj|savjetnik|mentor|visok/.test(z))
    return "I";
  if (/\bsss\b|srednj|tajnic|administrat|referent|ra[čc]unovo[dđ]|knji[žz]ni[čc]ar|voditelj|blagajn/.test(z))
    return "III";
  return "ostali";
}

export interface GoUnos {
  /** Ukupni staž (stupac J), parsiran. */
  staz: Staz | null;
  kategorija: Kategorija;
  uvjeti?: Partial<Record<UvjetKey, boolean>>;
  /** Socijalni kriteriji — OSOBNI PODACI, ne spremati u bazu. */
  brojDjece?: number;
  djecaSTeskocama?: number;
  invaliditet?: boolean;
  samohrani?: boolean;
  domovinskiRat?: boolean;
  rezultati?: Rezultati;
}

export interface GoStavka {
  label: string;
  dani: number;
}

export interface GoRezultat {
  stavke: GoStavka[];
  /** Zbroj prije poda/maksimuma. */
  zbroj: number;
  /** Konačni broj dana nakon zakonskog minimuma i maksimuma. */
  ukupno: number;
  /** True ako je maksimum (30) odrezao zbroj. */
  odrezanoMax: boolean;
  /** True ako je zakonski minimum (20) podigao zbroj. */
  podignutoMin: boolean;
}

/** Izračun godišnjeg odmora za jednog djelatnika. */
export function izracunajGodisnji(unos: GoUnos, cfg: GoConfig = KU_OS): GoRezultat {
  const stavke: GoStavka[] = [{ label: "Osnovica", dani: cfg.osnovica }];

  const godine = stazToYears(unos.staz);
  const stazDani = daniZaStaz(godine, cfg);
  if (stazDani) stavke.push({ label: "Radni staž", dani: stazDani });

  stavke.push({
    label: `Složenost (kat. ${unos.kategorija})`,
    dani: cfg.slozenost[unos.kategorija],
  });

  for (const key of Object.keys(cfg.uvjeti) as UvjetKey[]) {
    if (unos.uvjeti?.[key]) stavke.push({ label: UVJET_LABEL[key], dani: cfg.uvjeti[key] });
  }

  // Socijalni (osobni podaci — samo u izračunu, ne u bazi).
  const djece = Math.max(0, unos.brojDjece ?? 0);
  if (djece > 0) {
    stavke.push({ label: "Malodobno dijete (1.)", dani: 2 });
    if (djece > 1) stavke.push({ label: `Daljnja djeca (${djece - 1})`, dani: djece - 1 });
  }
  const teskoce = Math.max(0, unos.djecaSTeskocama ?? 0);
  if (teskoce > 0) stavke.push({ label: `Dijete s teškoćama (${teskoce})`, dani: 3 * teskoce });
  if (unos.invaliditet) stavke.push({ label: "Osoba s invaliditetom", dani: 2 });
  if (unos.samohrani) stavke.push({ label: "Samohrani roditelj", dani: 1 });
  if (unos.domovinskiRat) stavke.push({ label: "Sudionik Domovinskog rata", dani: 1 });

  if (unos.rezultati) {
    stavke.push({
      label: `Radni rezultati (${unos.rezultati.replace("_", " ")})`,
      dani: cfg.rezultati[unos.rezultati],
    });
  }

  const zbroj = stavke.reduce((s, x) => s + x.dani, 0);
  const odrezanoMax = zbroj > cfg.maksimum;
  const podignutoMin = zbroj < cfg.zakonskiMin;
  const ukupno = Math.min(cfg.maksimum, Math.max(cfg.zakonskiMin, zbroj));

  return { stavke, zbroj, ukupno, odrezanoMax, podignutoMin };
}
