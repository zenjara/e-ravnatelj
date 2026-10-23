// scripts/import-schools.mjs
// Pre-populate the `schools` table from the public national list of primary
// schools (data.gov.hr "Osnovne škole", sourced from e-Matica, Open Licence).
//
// Run:  npm run import:schools
//   --dry           parse + print a sample, DO NOT touch the DB
//   --file <path>   parse a local CSV instead of fetching (for testing)
//
// NOTE on the CSV: the datastore dump has NO real header row — the first line is
// actually the first school, and columns are positional. We parse by position
// and key rows by the e-Matica šifra (e.g. "17-125-001"). No OIB / no PII beyond
// the school's public contact + the principal's name (a public official).

import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

const CSV_URL = "https://data.gov.hr/ckan/datastore/dump/osnovne-skole?bom=True";
// e-Matica code; most are dash-form "17-125-001", some are slash-form "2/14/01".
const SIFRA_RE = /^\d{1,2}[-/]\d{2,3}[-/]\d{2,3}$/;

// Column positions in the dump (0-based).
const COL = {
  adresa: 1, telefon: 2, mjesto: 3, naziv: 4, posta: 6,
  ravnatelj: 7, web: 10, email: 11, sifra: 12, zupanija: 13,
};

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i > -1 ? args[i + 1] : undefined; };

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const cleanOrNull = (v) => clean(v) || null;

function parseRows(csv) {
  const wb = XLSX.read(csv, { type: "string" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, blankrows: false });
  const out = [];
  for (const r of rows) {
    const sifra = clean(r[COL.sifra]);
    const naziv = clean(r[COL.naziv]);
    if (!SIFRA_RE.test(sifra) || !naziv) continue; // skip stray/misaligned lines
    out.push({
      sifra,
      naziv,
      mjesto: cleanOrNull(r[COL.mjesto]),
      adresa: cleanOrNull(r[COL.adresa]),
      posta: cleanOrNull(r[COL.posta]),
      zupanija: cleanOrNull(r[COL.zupanija]),
      ravnatelj: cleanOrNull(r[COL.ravnatelj]),
      email: cleanOrNull(r[COL.email]),
      web: cleanOrNull(r[COL.web]),
      telefon: cleanOrNull(r[COL.telefon]),
    });
  }
  // De-dupe by šifra (keep first).
  const seen = new Set();
  return out.filter((s) => (seen.has(s.sifra) ? false : seen.add(s.sifra)));
}

async function loadCsv() {
  const file = opt("--file");
  if (file) return readFile(file, "utf8");
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Preuzimanje CSV-a nije uspjelo: HTTP ${res.status}`);
  return res.text();
}

function env(n) {
  const v = process.env[n];
  if (!v) { console.error(`✗ Nedostaje ${n} (pokreni preko "npm run import:schools").`); process.exit(1); }
  return v;
}

async function main() {
  const csv = await loadCsv();
  const schools = parseRows(csv);
  if (schools.length === 0) throw new Error("Nijedna škola nije parsirana — provjeri format CSV-a.");

  console.log(`Parsirano ${schools.length} škola.`);
  const sample = schools.find((s) => /lovre kati/i.test(s.naziv)) ?? schools[0];
  console.log("Primjer:", sample);

  if (has("--dry")) {
    console.log("\n(--dry) Baza nije dirana.");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const now = new Date().toISOString();
  let done = 0;
  for (let i = 0; i < schools.length; i += 200) {
    const batch = schools.slice(i, i + 200).map((s) => ({ ...s, updated_at: now }));
    const { error } = await supabase.from("schools").upsert(batch, { onConflict: "sifra" });
    if (error) {
      console.error("✗ upsert nije uspio:", error.message);
      if (/relation .*schools.* does not exist|schema cache/i.test(error.message)) {
        console.error("  → Primijeni migraciju 0005_schools.sql prvo.");
      }
      process.exit(1);
    }
    done += batch.length;
    console.log(`  ${done}/${schools.length}`);
  }
  console.log(`\n✓ Uvezeno/ažurirano ${done} škola u tablicu "schools".`);
}

main().catch((e) => { console.error("✗", e.message || e); process.exit(1); });
