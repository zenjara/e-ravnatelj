import "server-only";
import * as XLSX from "xlsx";

/**
 * Read the ministry workload table (the big xlsx each school fills in) and
 * extract the school meta + one record per teacher. Mirrors the sheet layout of
 * "TABLICA ZA POPUNJAVANJE" (fixed column positions). Ported from the verified
 * standalone prototype.
 */

const SHEET = "TABLICA ZA POPUNJAVANJE";

export interface Duty {
  name: string;
  h: number;
}

export interface School {
  naziv: string;
  adresa: string;
  mjesto: string;
  zupanija: string;
  ravnatelj: string;
  sifra: string;
}

export interface Teacher {
  row: number;
  name: string;
  female: boolean;
  predmet: string;
  razredi: string;
  razrednistvo: string;
  redovita: number;
  izborna: number;
  razr_sati: number;
  ukupno: number;
  dop: number;
  dod: number;
  ina: number;
  ukupno_noor: number;
  pripremanje: number;
  ostali_razrednik: number;
  ukupno_tjedno: number;
  radno_vrijeme: string;
  ab: number; // UKUPNO A (stupac AB)
  cl13_7: Duty[];
  cl8: Duty[];
  ku: Duty[];
  umanjenje: number;
  // B-blok (ostali dio NO-OR) — puni zbrojevi iz tablice
  b_total: number; // UKUPNO B (stupac AV)
  projekti: number; // AG:AK — projekti, ŽSV, povjerenstva, plivanje, PSP
  voditelji_b: number; // AL:AR — voditeljski poslovi (čl. 7. i 8.)
  ku_b: number; // AS:AT — radnički vijećnik / povjerenik ZNR (čl. 8.a KU)
  umanjenje_b: number; // AU — umanjenje (čl. 38.) u B-bloku
  // C-blok (ostali poslovi)
  c_total: number; // UKUPNO ostali poslovi (stupac BG)
  ostali_cl: number; // BF — ostali poslovi iz čl. 5. Prav. / čl. 42., 56. KU
  /** Tablica si sama proturječi: UKUPNO A + UKUPNO B ≠ UKUPNO NO-OR (npr. unos iznad norme). */
  noor_mismatch: boolean;
  urbrojIndex?: number;
}

export interface ParsedTable {
  school: School;
  teachers: Teacher[];
}

type WS = XLSX.WorkSheet;

function cell(ws: WS, addr: string): unknown {
  const c = ws[addr] as { v?: unknown } | undefined;
  return c == null ? null : c.v;
}

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

/**
 * Common Croatian male given names ending in -a. Without this exception list the
 * naive "-a → female" rule would gender them wrong in an official Odluka
 * (Učitelj/Učiteljica, Ravnatelj/Ravnateljica). Still a heuristic — a per-row
 * override in the UI would be the complete fix.
 */
const MALE_A = new Set([
  "luka", "nikola", "matija", "ivica", "andrija", "saša", "sasa",
  "ilija", "jakša", "jaksa", "kuzma", "jurica", "noa",
]);

/** Infer gender from first name (Croatian heuristic: -a → female, with exceptions). */
function isFemale(name: string): boolean {
  const first = String(name).trim().split(/[\s/]/)[0] ?? "";
  if (MALE_A.has(first.toLowerCase())) return false;
  return /a$/i.test(first);
}

const DUTY_13_7: Record<string, string> = {
  I: "Zbor i/ili orkestar", J: "Vizualni identitet škole", K: "Sportski klub/društvo",
  L: "Klub mladih tehničara", M: "Učenička zadruga", N: "Mentorski rad s darovitima",
};
const DUTY_8: Record<string, string> = {
  O: "e-administrator", P: "IKT podrška", Q: "Satničar", R: "Voditelj smjene",
  S: "Voditelj područne škole", T: "Voditelj POS razrednog odjela",
  U: "Voditelj odjela na jeziku i pismu nacionalne manjine", V: "Voditelj bazena",
};
const DUTY_KU: Record<string, string> = {
  W: "Radnički vijećnik / sindikalni povjerenik", X: "Povjerenik zaštite na radu",
};

function duties(ws: WS, r: number, map: Record<string, string>): Duty[] {
  const out: Duty[] = [];
  for (const [col, name] of Object.entries(map)) {
    const v = cell(ws, `${col}${r}`);
    if (typeof v === "number" && v !== 0) out.push({ name, h: v });
  }
  return out;
}

/** Sum the numeric cells across an inclusive column range (e.g. "AG".."AK") in row r. */
function rangeSum(ws: WS, r: number, fromCol: string, toCol: string): number {
  const a = XLSX.utils.decode_col(fromCol);
  const b = XLSX.utils.decode_col(toCol);
  let s = 0;
  for (let c = a; c <= b; c++) {
    const v = cell(ws, `${XLSX.utils.encode_col(c)}${r}`);
    if (typeof v === "number") s += v;
  }
  return s;
}

function parseSchool(ws: WS): School {
  const adresa = str(cell(ws, "B5"));
  // mjesto = last letter-starting token in the address (e.g. "… 21 210 Solin")
  const mjesto = (adresa.match(/([A-ZŠĐČĆŽ][a-zšđčćž]+)\s*$/) || [, ""])[1] || adresa;
  return {
    naziv: str(cell(ws, "B3")),
    adresa,
    mjesto,
    zupanija: str(cell(ws, "B7")),
    ravnatelj: str(cell(ws, "AK5")),
    sifra: str(cell(ws, "AK3")),
  };
}

function parseTeachers(ws: WS): Teacher[] {
  const out: Teacher[] = [];
  for (let r = 19; r <= 112; r++) {
    const name = cell(ws, `A${r}`);
    const predmet = cell(ws, `B${r}`);
    const ukupno = cell(ws, `H${r}`);
    if (!name || !predmet || typeof ukupno !== "number") continue;
    if (String(name).toLowerCase().includes("novi učitelj")) continue;
    out.push({
      row: r,
      name: str(name),
      female: isFemale(String(name)),
      predmet: str(predmet),
      razredi: str(cell(ws, `C${r}`)),
      razrednistvo: str(cell(ws, `D${r}`)),
      redovita: num(cell(ws, `E${r}`)),
      izborna: num(cell(ws, `F${r}`)),
      razr_sati: num(cell(ws, `G${r}`)),
      ukupno: num(ukupno),
      dop: num(cell(ws, `AD${r}`)),
      dod: num(cell(ws, `AE${r}`)),
      ina: num(cell(ws, `AF${r}`)),
      ukupno_noor: num(cell(ws, `AZ${r}`)),
      pripremanje: num(cell(ws, `BA${r}`)),
      ostali_razrednik: num(cell(ws, `BC${r}`)),
      ukupno_tjedno: num(cell(ws, `BI${r}`)),
      radno_vrijeme: str(cell(ws, `BK${r}`)),
      ab: num(cell(ws, `AB${r}`)),
      cl13_7: duties(ws, r, DUTY_13_7),
      cl8: duties(ws, r, DUTY_8),
      ku: duties(ws, r, DUTY_KU),
      umanjenje: num(cell(ws, `AA${r}`)),
      b_total: num(cell(ws, `AV${r}`)),
      projekti: rangeSum(ws, r, "AG", "AK"),
      voditelji_b: rangeSum(ws, r, "AL", "AR"),
      ku_b: rangeSum(ws, r, "AS", "AT"),
      umanjenje_b: num(cell(ws, `AU${r}`)),
      c_total: num(cell(ws, `BG${r}`)),
      ostali_cl: num(cell(ws, `BF${r}`)),
      noor_mismatch:
        Math.round((num(cell(ws, `AB${r}`)) + num(cell(ws, `AV${r}`))) * 100) !==
        Math.round(num(cell(ws, `AZ${r}`)) * 100),
    });
  }
  return out;
}

/** Parse an uploaded workbook (as a Buffer/Uint8Array). Throws if the expected sheet is missing. */
export function parseTable(buf: Buffer | Uint8Array): ParsedTable {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[SHEET];
  if (!ws) {
    throw new Error(
      `U datoteci nema lista "${SHEET}". Učitajte ispunjenu ministarsku tablicu zaduženja.`,
    );
  }
  return { school: parseSchool(ws), teachers: parseTeachers(ws) };
}
