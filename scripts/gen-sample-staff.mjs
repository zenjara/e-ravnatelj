/**
 * Generate a sample e-Matica staff export (ogledni primjer) with DUMMY names,
 * mirroring the real column layout. JMBG/OIB left blank on purpose (sensitive).
 * Other values are realistic test data covering every staž-encoding case.
 *
 *   node scripts/gen-sample-staff.mjs
 *
 * Output: sample-data/e-matica-primjer.xlsx  (+ a staž verification table in stdout)
 */
import * as XLSX from "xlsx";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Same algorithm as src/lib/ucitelji/staz.ts (kept in sync; this is for verification).
function parseStaz(raw) {
  const clean = String(raw ?? "").trim();
  if (clean === "") return null;
  const digits = clean.replace(/\D/g, "");
  if (digits === "") return null;
  const trimmed = digits.replace(/^0+/, "");
  if (trimmed === "") return { godine: 0, mjeseci: 0, dani: 0 };
  if (trimmed.length <= 2) return { godine: Number(trimmed), mjeseci: 0, dani: 0 };
  const p = trimmed.slice(-6).padStart(6, "0");
  return { godine: +p.slice(0, 2), mjeseci: +p.slice(2, 4), dani: +p.slice(4, 6) };
}
function formatStaz(s) {
  if (!s) return "—";
  const parts = [];
  if (s.godine) parts.push(`${s.godine} g`);
  if (s.mjeseci) parts.push(`${s.mjeseci} mj`);
  if (s.dani) parts.push(`${s.dani} d`);
  return parts.length ? parts.join(" ") : "0 g";
}

// Header exactly as in the e-Matica export (columns A–O).
const header = [
  "ID", "JMBG", "OIB", "Prezime", "Ime", "Datum rođenja", "Spol",
  "Mjesto rođenja", "Državljanstvo", "Radno iskustvo (ukupno)",
  "Radno iskustvo (obrazovno)", "Zvanje", "Ustanova", "Napomena", "",
];

// Dummy people. [Prezime, Ime, DOB, Spol, Mjesto, J (ukupno), K (obrazovno), Zvanje, Ustanova]
// Mix of teachers + non-teaching staff; staž values cover 0/1-2 digit/3-6 digit cases.
const people = [
  ["Horvat", "Ana", "02.08.1984", "Ž", "Split", 3, 3, "prof. hrvatskog jezika", "Filozofski fakultet u Splitu"],
  ["Kovač", "Marija", "18.06.1989", "Ž", "Imotski", 1, 1, "mag. primarnog obrazovanja", "Učiteljski fakultet u Splitu"],
  ["Babić", "Ivana", "21.10.1964", "Ž", "Split", 27, 27, "prof. matematike", "PMF u Splitu"],
  ["Marić", "Petra", "24.11.1975", "Ž", "Split", 210027, 0, "spremačica", ""],
  ["Jurić", "Karla", "17.10.2001", "Ž", "Split", 0, 0, "pripravnik", "Filozofski fakultet u Splitu"],
  ["Novak", "Žana", "18.07.1980", "Ž", "Split", 140415, 40906, "prof. engleskog jezika", "Filozofski fakultet u Splitu"],
  ["Perić", "Danica", "26.01.1962", "Ž", "Neorić", 33, 30, "prof. razredne nastave", "Učiteljski fakultet u Splitu"],
  ["Vuković", "Silvana", "18.01.1965", "Ž", "Split", 14, 1, "tajnica", "Ekonomska i upravna škola"],
  ["Knežević", "Mira", "23.11.1975", "Ž", "Kladnjice", 25, 0, "kuharica", "Obrtnička škola u Splitu"],
  ["Marković", "Margita", "03.09.1965", "Ž", "Split", 27, 27, "prof. fizike", "PMF u Splitu"],
  ["Pavić", "Nada", "15.08.1970", "Ž", "Split", 20, 0, "domar", "Obrtnička škola u Splitu"],
  ["Božić", "Antica", "24.09.1992", "Ž", "Split", 0, 0, "pripravnik", "Filozofski fakultet u Splitu"],
  ["Tomić", "Goran", "05.08.1982", "M", "Omiš", 7, 7, "prof. informatike", "PMF u Splitu"],
  ["Blažević", "Jagoda", "12.09.1971", "Ž", "Split", 26, 26, "prof. biologije", "PMF u Splitu"],
  ["Grgić", "Vesna", "30.08.1966", "Ž", "Medovdolac", 27, 27, "prof. kemije", "PMF u Splitu"],
  ["Šarić", "Jelena", "18.09.1978", "Ž", "Imotski", 2, 0, "stručni suradnik knjižničar", "Filozofski fakultet u Zadru"],
  ["Radić", "Tina", "30.07.1998", "Ž", "Split", 2, 0, "pripravnik", ""],
  ["Bošković", "Silvija", "30.08.1980", "Ž", "Split", 11, 11, "prof. povijesti", "Filozofski fakultet u Zadru"],
  ["Lovrić", "Jasna", "04.06.1969", "Ž", "Vukovar", 22, 22, "prof. geografije", "Filozofski fakultet u Osijeku"],
  ["Matić", "Nina", "07.10.1977", "Ž", "Split", 1100, 0, "voditelj računovodstva", ""],
  ["Šimić", "Slava", "03.03.1974", "Ž", "Vrgorac", 8, 0, "administrativni referent", "Ekonomska i upravna škola"],
  ["Barišić", "Marta", "14.07.1962", "Ž", "Donje Ogorje", 28, 27, "prof. likovne kulture", "Akademija likovnih umjetnosti"],
  ["Kralj", "Nataša", "29.11.1965", "Ž", "Split", 17, 0, "računovođa", "Ekonomski fakultet u Splitu"],
  ["Vidović", "Sara", "28.09.2000", "Ž", "Split", 128, 105, "učitelj mentor", "Učiteljski fakultet u Splitu"],
  ["Kovačević", "Renato", "09.10.1970", "M", "Split", 1, 0, "nastavnik tehničke kulture", "Građevinsko-geodetski fakultet"],
  ["Petrović", "Draženka", "26.10.1964", "Ž", "Trogir", 37, 0, "spremačica", "Ekonomski fakultet u Splitu"],
];

const outDir = join(root, "sample-data");
mkdirSync(outDir, { recursive: true });

/** Build the sheet; withZvanje=false leaves the Zvanje column empty (as in the real export). */
function writeBook(filename, withZvanje) {
  const aoa = [header];
  people.forEach((p, i) => {
    const [prez, ime, dob, spol, mjesto, j, k, zvanje, ustanova] = p;
    aoa.push([
      1000 + i, "", "", prez, ime, dob, spol, mjesto, "hrvatsko", j, k,
      withZvanje ? zvanje : "", ustanova, "", "",
    ]);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Djelatnici");
  const outFile = join(outDir, filename);
  XLSX.writeFile(wb, outFile);
  console.log(`✅ Zapisano: ${outFile}  (${people.length} djelatnika${withZvanje ? "" : ", bez zvanja"})`);
}

writeBook("e-matica-primjer.xlsx", true);
writeBook("e-matica-primjer-bez-zvanja.xlsx", false);
console.log("");

// Verification table.
console.log("Provjera formatiranja staža (J = ukupno, K = obrazovno):\n");
console.log(
  "Prezime Ime".padEnd(22) +
  "J (sirovo)".padEnd(12) + "→ ukupno".padEnd(18) +
  "K (sirovo)".padEnd(12) + "→ obrazovno",
);
console.log("─".repeat(80));
for (const p of people) {
  const [prez, ime, , , , j, k] = p;
  console.log(
    `${prez} ${ime}`.padEnd(22) +
    String(j).padEnd(12) + formatStaz(parseStaz(j)).padEnd(18) +
    String(k).padEnd(12) + formatStaz(parseStaz(k)),
  );
}
