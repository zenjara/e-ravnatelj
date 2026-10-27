// scripts/seed-rokovi.mjs
// Seed the global deadline registry (`rokovi`) from the confirmed draft.
// Provisional dates — refine in the DB (admin) once verified. Run: npm run seed:rokovi
// Idempotent: upserts on `slug`.

import { createClient } from "@supabase/supabase-js";

const ROKOVI = [
  { slug: "gpp", naziv: "Donošenje GPP-a (Godišnji plan i program rada)", kategorija: "Planiranje", md: "10-07", rule: "fixed", osnova: "ZOOOSŠ", reminder_days: 14, provjeriti: false,
    checklist: ["Nastavničko vijeće predlaže", "Školski odbor donosi (do 7.10.)", "Objaviti na mrežnim stranicama"] },
  { slug: "skolski-kurikulum", naziv: "Donošenje Školskog kurikuluma", kategorija: "Planiranje", md: "10-07", rule: "fixed", osnova: "ZOOOSŠ", reminder_days: 14, provjeriti: false,
    checklist: ["Nastavničko vijeće predlaže", "Školski odbor donosi (do 7.10.)", "Objaviti na mrežnim stranicama"] },
  { slug: "predaja-gpp-mzo", naziv: "Predaja GPP-a i kurikuluma MZO (elektronički)", kategorija: "Planiranje", md: "10-15", rule: "fixed", osnova: "ZOOOSŠ", reminder_days: 7, provjeriti: false,
    checklist: ["Predati elektronički do 15.10."] },
  { slug: "e-matica-pocetak", naziv: "e-Matica — unos na početku školske godine", kategorija: "e-Matica", md: "09-30", rule: "fixed", osnova: "Pravilnik o e-Matici", reminder_days: 7, provjeriti: false, checklist: [] },
  { slug: "e-matica-kraj", naziv: "e-Matica — unos na kraju školske godine", kategorija: "e-Matica", md: "09-07", rule: "fixed", osnova: "Pravilnik o e-Matici", reminder_days: 7, provjeriti: false, checklist: [] },
  { slug: "fiskalna-odgovornost", naziv: "Izjava o fiskalnoj odgovornosti (+ upitnik)", kategorija: "Financije", md: "02-28", rule: "fixed", osnova: "Zakon o fiskalnoj odgovornosti; Uredba NN 95/19", reminder_days: 21, provjeriti: false,
    checklist: ["Popuniti Upitnik (Prilog 2.a)", "Plan otklanjanja slabosti/nepravilnosti", "Potpisati Izjavu", "Predati putem aplikacije", "Čuvati dokumentaciju 7 godina"] },
  { slug: "fin-izvjestaji-godisnji", naziv: "Godišnji financijski izvještaji (1.1.–31.12.)", kategorija: "Financije", md: "01-31", rule: "fixed", osnova: "Pravilnik o financijskom izvještavanju u proračunskom računovodstvu", reminder_days: 14, provjeriti: true, checklist: [] },
  { slug: "fin-izvjestaji-polugodisnji", naziv: "Polugodišnji financijski izvještaji (1.1.–30.6.)", kategorija: "Financije", md: "07-15", rule: "fixed", osnova: "Pravilnik o financijskom izvještavanju", reminder_days: 14, provjeriti: true, checklist: [] },
  { slug: "zppi-izvjesce", naziv: "Godišnje izvješće o pravu na pristup informacijama (Povjereniku)", kategorija: "Izvještavanje", md: "01-31", rule: "fixed", osnova: "Zakon o pravu na pristup informacijama", reminder_days: 14, provjeriti: false,
    checklist: ["Prikupiti podatke o zahtjevima", "Ispuniti obrazac", "Poslati Povjereniku do 31.1.", "Objaviti na webu"] },
  { slug: "inventura", naziv: "Inventura / popis imovine i obveza (stanje 31.12.)", kategorija: "Financije", md: "12-31", rule: "fixed", osnova: "Pravilnik o proračunskom računovodstvu", reminder_days: 21, provjeriti: true,
    checklist: ["Imenovati povjerenstvo", "Popis sa stanjem 31.12.", "Izvješće o popisu", "Knjiženje razlika"] },
  { slug: "plan-nabave", naziv: "Plan nabave — donošenje i objava u EOJN", kategorija: "Nabava", md: "01-31", rule: "fixed", osnova: "Zakon o javnoj nabavi", reminder_days: 14, provjeriti: true,
    checklist: ["Donijeti nakon proračuna", "Objaviti/ažurirati u EOJN", "Voditi registar ugovora"] },
  { slug: "izvjesce-realizacija-gpp", naziv: "Izvješće o realizaciji GPP-a (godišnje izvješće o radu)", kategorija: "Izvještavanje", md: "06-30", rule: "fixed", osnova: "ZOOOSŠ", reminder_days: 14, provjeriti: true, checklist: [] },
  { slug: "upisi-prvi-razred", naziv: "Upisi u 1. razred (testiranja / razdoblje)", kategorija: "Upisi", md: "06-15", rule: "yearly", osnova: "Pravilnik o upisu + godišnja odluka MZO", reminder_days: 21, provjeriti: true, checklist: [] },
  { slug: "nacionalni-ispiti", naziv: "Nacionalni ispiti (NCVVO) — 4. i 8. razred", kategorija: "Vrednovanje", md: "03-01", rule: "yearly", osnova: "NCVVO — Kalendar provedbe nacionalnih ispita 2026./2027.", reminder_days: 21, provjeriti: false,
    checklist: ["4. razred: 1.–5.3.2027.", "8. razred: 8.–24.3.2027.", "Svi ispiti u 9:00 (redoviti nastavni dani)", "Organizirati dežurstva i prostor", "Raspored po predmetima u kalendaru"] },
  { slug: "dzs-izvjesca", naziv: "Statistička izvješća DZS (početak/kraj nastavne godine)", kategorija: "Izvještavanje", md: "10-01", rule: "yearly", osnova: "Državni zavod za statistiku", reminder_days: 10, provjeriti: true, checklist: [] },
];

function env(n) {
  const v = process.env[n];
  if (!v) { console.error(`✗ Nedostaje ${n} (pokreni preko "npm run seed:rokovi").`); process.exit(1); }
  return v;
}

async function main() {
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const now = new Date().toISOString();
  const rows = ROKOVI.map((r, i) => ({ ...r, sort: i + 1, aktivan: true, updated_at: now }));

  const { error } = await supabase.from("rokovi").upsert(rows, { onConflict: "slug" });
  if (error) {
    console.error("✗ upsert nije uspio:", error.message);
    if (/relation .*rokovi.* does not exist|schema cache/i.test(error.message)) {
      console.error("  → Primijeni migraciju 0007_rokovi.sql prvo.");
    }
    process.exit(1);
  }
  console.log(`✓ Uvezeno/ažurirano ${rows.length} rokova.`);
  for (const r of rows) console.log(`  • ${r.md}  ${r.naziv}${r.provjeriti ? "  ⚠" : ""}`);
}

main().catch((e) => { console.error("✗", e.message || e); process.exit(1); });
