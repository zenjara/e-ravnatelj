import "server-only";
import * as XLSX from "xlsx";

/**
 * Parse an uploaded staff list (e-Matica "Djelatnici → Popis → Izvoz", Excel or
 * CSV) into {prezime, ime, radno_mjesto} rows. Generic/best-effort: it detects
 * the header row and maps columns by name, so it tolerates format differences.
 * The preview in the UI is fully editable, so imperfect detection is recoverable.
 *
 * OIB is NEVER read, even though the export contains it. No student data.
 */

export interface StaffRow {
  prezime: string;
  ime: string;
  radno_mjesto: string;
  /** Raw e-Matica "Radno iskustvo (ukupno)" code — parsed for display by staz.ts. */
  staz_ukupno: number | null;
  /** Raw e-Matica "Radno iskustvo (obrazovno)" code. */
  staz_obrazovni: number | null;
}

export interface ParsedStaff {
  rows: StaffRow[];
  /** Which source columns were recognized (for a short "detected" note). */
  detected: string[];
  /** True if an OIB column was present and deliberately skipped. */
  droppedOib: boolean;
}

const norm = (v: unknown) =>
  String(v ?? "").replace(/\s+/g, " ").trim();
const low = (v: unknown) => norm(v).toLowerCase();

const RE = {
  prezime: /prezim/i,
  ime: /(^|\b)ime\b/i,
  combined: /ime i prezime|prezime i ime|ime_prezime|^djelatnik|^zaposlenik|^naziv|ime\s*,?\s*prezime/i,
  radno: /radno mjesto|radno_mjesto|zvanje|predmet|poslovi|struka|funkcij|vrsta rada|naziv radnog/i,
  oib: /\boib\b/i,
  stazUkupno: /radno iskustvo.*ukupno|ukupn.*(radno iskustvo|sta[žz])|sta[žz].*ukupno/i,
  stazObraz: /radno iskustvo.*obrazov|obrazov.*(radno iskustvo|sta[žz])|sta[žz].*obrazov/i,
};

/** Parse a staž cell to its raw integer code (digits only), or null when empty. */
function toStazCode(v: unknown): number | null {
  const d = String(v ?? "").replace(/\D/g, "");
  return d === "" ? null : Number(d);
}

/** Find the header row: the first of the first ~15 rows with ≥2 recognizable labels. */
function findHeader(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 15);
  let best = -1, bestScore = 0;
  for (let i = 0; i < limit; i++) {
    const cells = matrix[i].map(low);
    let score = 0;
    for (const re of [RE.prezime, RE.ime, RE.combined, RE.radno, RE.oib]) {
      if (cells.some((c) => re.test(c))) score++;
    }
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return bestScore >= 2 ? best : -1;
}

function firstMatch(headers: string[], re: RegExp): number {
  return headers.findIndex((h) => re.test(h));
}

export function parseStaff(buf: Buffer | Uint8Array): ParsedStaff {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [], detected: [], droppedOib: false };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false });
  if (matrix.length === 0) return { rows: [], detected: [], droppedOib: false };

  const headerIdx = findHeader(matrix);
  const detected: string[] = [];
  let colPrezime = -1, colIme = -1, colCombined = -1, colRadno = -1, hasOib = false;
  let colStazU = -1, colStazO = -1;

  if (headerIdx >= 0) {
    const headers = matrix[headerIdx].map(low);
    colPrezime = firstMatch(headers, RE.prezime);
    colIme = headers.findIndex((h) => RE.ime.test(h) && !RE.prezime.test(h));
    colRadno = firstMatch(headers, RE.radno);
    colStazU = firstMatch(headers, RE.stazUkupno);
    colStazO = firstMatch(headers, RE.stazObraz);
    hasOib = headers.some((h) => RE.oib.test(h));
    if (colPrezime < 0 && colIme < 0) colCombined = firstMatch(headers, RE.combined);
    if (colPrezime >= 0) detected.push("prezime");
    if (colIme >= 0) detected.push("ime");
    if (colCombined >= 0) detected.push("ime i prezime");
    if (colRadno >= 0) detected.push("radno mjesto");
    if (colStazU >= 0) detected.push("staž (ukupno)");
    if (colStazO >= 0) detected.push("staž (obrazovno)");
  }

  // Fallback when no header recognized: assume col0=prezime, col1=ime, col2=radno.
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : 0;
  if (headerIdx < 0) { colPrezime = 0; colIme = 1; colRadno = 2; }

  const rows: StaffRow[] = [];
  for (let i = dataStart; i < matrix.length; i++) {
    const r = matrix[i];
    let prezime = "", ime = "";
    if (colCombined >= 0) {
      // Combined "Prezime Ime" → keep whole string under prezime; user edits if needed.
      prezime = norm(r[colCombined]);
    } else {
      prezime = colPrezime >= 0 ? norm(r[colPrezime]) : "";
      ime = colIme >= 0 ? norm(r[colIme]) : "";
    }
    const radno_mjesto = colRadno >= 0 ? norm(r[colRadno]) : "";
    if (!prezime && !ime) continue; // skip rows without a name
    rows.push({
      prezime,
      ime,
      radno_mjesto,
      staz_ukupno: colStazU >= 0 ? toStazCode(r[colStazU]) : null,
      staz_obrazovni: colStazO >= 0 ? toStazCode(r[colStazO]) : null,
    });
  }

  return { rows, detected, droppedOib: hasOib };
}
