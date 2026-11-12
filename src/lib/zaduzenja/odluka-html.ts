import type { School, Teacher, Duty } from "./parse";
import { radniDaniBreakdown, nenastavniRadniDani } from "@/lib/school-calendar";

/**
 * HTML for one Odluka o tjednom i godišnjem zaduženju (A4, print-ready).
 *
 * Struktura prati ministarsku tablicu (A / B / C) i verificirani primjer:
 *   I.  NEPOSREDNI RAD — A) redovita i poslovi koji se smatraju redovitom
 *       nastavom (međuzbroj A) + B) ostali dio NO-OR-a (međuzbroj B) + A+B.
 *   II. OSTALI POSLOVI (zaseban zbroj).
 *   III. GODIŠNJA REKAPITULACIJA.
 *
 * Izračuni (vidi i napomene ispod tablica u samom dokumentu):
 *   • Godišnji sati po stavci = tjedni sati × `nastTjedana` (zadano 36).
 *   • Ostali poslovi (godišnje) = N × (tjedni sati ÷ 5), gdje je N broj
 *     nenastavnih radnih dana (radni dani 1.9.–31.8. − nastavni − blagdani)
 *     umanjen za dane godišnjeg odmora (`godisnjiDana`, zadano 30; kasnije se
 *     može povući po učitelju iz modula „Godišnji odmori").
 */

export interface OdlukaCfg {
  klasa: string;
  urbrojBase: string;
  godina: string;
  date: Date;
  urbrojIndex: number;
  /** Dani godišnjeg odmora koji se oduzimaju od nenastavnih radnih dana (zadano 30). */
  godisnjiDana?: number;
  /** Broj nastavnih tjedana za godišnji preračun (zadano 36). */
  nastTjedana?: number;
}

const MJ = [
  "siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja",
  "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca",
];
const dateHr = (d: Date) => `${d.getDate()}. ${MJ[d.getMonth()]} ${d.getFullYear()}.`;
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const n = (x: unknown): number =>
  x == null || x === "" ? 0 : Math.round(Number(x) * 100) / 100;

function rolePhrase(t: Teacher): string {
  const u = t.female ? "učiteljice" : "učitelja";
  if (/razredna nastava/i.test(t.predmet)) return `${u} razredne nastave`;
  return `${u} za nastavni predmet: ${esc(t.predmet)}`;
}

export function odlukaHTML(t: Teacher, school: School, cfg: OdlukaCfg): string {
  const U = t.female ? "Učiteljica" : "Učitelj";
  const u = t.female ? "učiteljica" : "učitelj";
  const rav = t.female ? "Ravnateljica" : "Ravnatelj";
  const puno = /PUNO/i.test(t.radno_vrijeme) && !/NEPUNO/i.test(t.radno_vrijeme);
  const urbroj = `${cfg.urbrojBase}-${cfg.urbrojIndex}`;

  const weeks = cfg.nastTjedana ?? 36;
  const godDana = cfg.godisnjiDana ?? 30;

  const tj = t.ukupno_tjedno || 0;
  const noor = t.ukupno_noor || 0;
  const aTot = t.ab || 0;
  const bTot = t.b_total || 0;
  const cTot = t.c_total || Math.max(0, tj - noor);

  // Godišnji preračun (vidi napomene ispod).
  const brk = radniDaniBreakdown();
  const N = nenastavniRadniDani(godDana);
  const daily = tj / 5;
  const nastGod = Math.round(tj * weeks);
  const ostaliGod = Math.round(N * daily);
  const ukupnoGod = nastGod + ostaliGod;

  const sumD = (a: Duty[]) => a.reduce((s, d) => s + d.h, 0);
  const names = (a: Duty[]) => (a.length ? ": " + a.map((d) => esc(d.name)).join(", ") : "");
  const teachClass =
    /razredna nastava/i.test(t.predmet) || t.razrednistvo ? t.razrednistvo : t.predmet;

  // Table helpers (5 stupca: R.br | vrsta | razredni odjeli | tjedno | godišnje).
  const g = (h: number) => (h ? n(h * weeks) : 0);
  const row = (br: string, naziv: string, h: number, razredi = "") =>
    `<tr><td class="c">${br}</td><td>${naziv}</td><td class="c">${esc(razredi)}</td><td class="c">${n(h)}</td><td class="c">${g(h)}</td></tr>`;
  const band = (txt: string) => `<tr class="sec"><td colspan="5">${txt}</td></tr>`;
  const sub = (naziv: string, h: number, cls = "subtot") =>
    `<tr class="${cls}"><td colspan="3">${naziv}</td><td class="c">${n(h)}</td><td class="c">${n(h * weeks)}</td></tr>`;

  // A) i B) — fiksna numeracija koja se nastavlja kroz oba bloka (kao u tablici).
  let no = 0;
  const br = () => `${++no}.`;
  const aRows = [
    row(br(), "Redovita nastava", t.redovita || 0, t.razredi),
    row(br(), "Izborna nastava", t.izborna || 0),
    row(br(), "Neposredni odgojno-obrazovni rad razrednika", t.razr_sati || 0, t.razrednistvo),
    row(br(), `Poslovi u sklopu tjedne obveze (čl. 13. st. 7. Pravilnika)${names(t.cl13_7 || [])}`, sumD(t.cl13_7 || [])),
    row(br(), `Posebni poslovi iz ustroja rada škole (čl. 8. Pravilnika)${names(t.cl8 || [])}`, sumD(t.cl8 || [])),
    row(br(), `Drugi poslovi na temelju Kolektivnog ugovora (čl. 8.a Pravilnika)${names(t.ku || [])}`, sumD(t.ku || [])),
    ...(t.umanjenje ? [row(br(), "Umanjenje radne obveze (čl. 38. KU)", -t.umanjenje)] : []),
  ].join("\n    ");
  const bRows = [
    row(br(), "Dopunska nastava", t.dop || 0, t.dop ? teachClass : ""),
    row(br(), "Dodatna nastava", t.dod || 0, t.dod ? teachClass : ""),
    row(br(), "Izvannastavne aktivnosti", t.ina || 0),
    row(br(), "Projekti, ŽSV i stručna povjerenstva (čl. 14. Pravilnika)", t.projekti || 0),
    row(br(), "Voditeljski poslovi (čl. 7. i 8. Pravilnika)", t.voditelji_b || 0),
    row(br(), "Drugi poslovi na temelju Kolektivnog ugovora (čl. 8.a)", t.ku_b || 0),
    ...(t.umanjenje_b ? [row(br(), "Umanjenje radne obveze (čl. 38. KU)", -t.umanjenje_b)] : []),
  ].join("\n    ");
  const abMark = t.noor_mismatch ? ' <sup class="fn">1)</sup>' : "";

  return `<section class="odluka">
  <div class="hdr">${esc(school.naziv.toUpperCase())}</div>
  <div class="meta">KLASA: ${esc(cfg.klasa)}<br>URBROJ: ${esc(urbroj)}</div>
  <div class="meta">U ${esc(school.mjesto)}, ${dateHr(cfg.date)} godine</div>

  <p class="just">${rav} ${esc(school.naziv)} na temelju članka 104. Zakona o odgoju i obrazovanju u osnovnoj i srednjoj školi
  (Narodne novine, broj 87/08, 86/09, 92/10, 105/10, 90/11, 5/12, 16/12, 86/12, 126/12, 94/13, 152/14, 7/17, 68/18, 98/19, 64/20, 151/22 i 156/23),
  članka 9. stavka 6. Pravilnika o tjednim radnim obvezama učitelja i stručnih suradnika u osnovnoj školi
  (Narodne novine, broj 34/14, 40/14, 103/14, 102/19, 122/19 i 27/24), Kolektivnog ugovora za zaposlenike u osnovnoškolskim ustanovama
  (Narodne novine, broj 51/18) i Odluke o produljenju primjene odredbi o materijalnim i nematerijalnim pravima zaposlenika u javnim službama
  ostvarenih temeljem granskih kolektivnih ugovora (Narodne novine, broj 35/24) donosi:</p>

  <h1>O D L U K U</h1>
  <p class="c subt">o tjednom i godišnjem zaduženju učitelja u školskoj godini ${esc(cfg.godina)}</p>

  <p><b>1.)</b> ${U} <b>${esc(t.name)}</b> zadužuje se u šk. god. ${esc(cfg.godina)} obvezama ${rolePhrase(t)}${
    t.razrednistvo ? `, razredništvom <b>${esc(t.razrednistvo)}</b>` : ""
  }, te drugim i ostalim poslovima kako je navedeno.</p>

  <p><b>2.)</b> Obveze iz točke prve ${u} će obavljati u <b>${puno ? "punom" : "nepunom"}</b>
  radnom vremenu od <b>${n(tj)}</b> sati tjedno i to:</p>

  <p class="caption">I. NEPOSREDNI ODGOJNO-OBRAZOVNI RAD S UČENICIMA</p>
  <table>
    <tr class="th"><td class="c">R.br.</td><td>Vrsta neposrednog odgojno-obrazovnog rada</td><td class="c">Razredni odjeli</td><td class="c">Sati tjedno</td><td class="c">Sati godišnje</td></tr>
    ${band("A) Redovita nastava i poslovi koji se smatraju redovitom nastavom")}
    ${aRows}
    ${sub("A — UKUPNO", aTot, "subtot")}
    ${band("B) Ostali dio neposrednog odgojno-obrazovnog rada")}
    ${bRows}
    ${sub("B — UKUPNO", bTot, "subtot")}
    ${sub(`UKUPNO NEPOSREDNI RAD (A + B)${abMark}`, noor, "ab")}
  </table>

  <p class="caption">II. OSTALI POSLOVI</p>
  <table>
    <tr class="th"><td class="c">R.br.</td><td>Vrsta ostalih poslova</td><td class="c"></td><td class="c">Sati tjedno</td><td class="c">Sati godišnje</td></tr>
    ${row("1.", "Ostali poslovi vođenja razrednog odjela", t.ostali_razrednik || 0)}
    ${row("2.", "Stručno-metodičko pripremanje za nastavu", t.pripremanje || 0)}
    ${row("3.", "Ostali poslovi učitelja (čl. 5. Pravilnika; čl. 42. i 56. KU)", t.ostali_cl || 0)}
    ${sub("UKUPNO OSTALI POSLOVI", cTot, "uk")}
  </table>

  <p class="caption">III. GODIŠNJE ZADUŽENJE</p>
  <table class="recap">
    <tr><td>Ukupno tjedno zaduženje</td><td>${n(tj)} sati</td></tr>
    <tr><td>Ukupno godišnje zaduženje (${weeks} nastavnih tjedana)</td><td>${nastGod} sati</td></tr>
    <tr><td>Ostali poslovi u nenastavnim danima (${N} dana × ${n(daily)} sati)</td><td>${ostaliGod} sati</td></tr>
    <tr class="grand"><td>UKUPNO GODIŠNJE ZADUŽENJE</td><td>${ukupnoGod} sati</td></tr>
  </table>
  <p class="fn-note"><b>Napomena o izračunu:</b> godišnji sati po stavci = tjedni sati × ${weeks} nastavnih tjedana. Ostali poslovi u nenastavnim danima = broj nenastavnih radnih dana × (tjedni sati ÷ 5). Nenastavni radni dani: ${brk.radni} radnih dana (pon.–pet., 1.9.–31.8.) − ${brk.nastavni} nastavnih dana − ${brk.blagdaniRadni} blagdana na radni dan = ${brk.nenastavni}, umanjeno za ${godDana} dana godišnjeg odmora = ${N}.</p>
  ${t.noor_mismatch ? `<p class="fn-note warn"><sup>1)</sup> U izvornoj ministarskoj tablici UKUPNO A (${n(aTot)}) + UKUPNO B (${n(bTot)}) iznosi ${n(aTot + bTot)}, a upisani „UKUPNO NO-OR" iznosi ${n(noor)} (stupac „PROVJERA zaduženja B"). Preuzet je zbroj iz tablice — potrebno je provjeriti unos.</p>` : ""}

  <p class="obr"><b>O b r a z l o ž e n j e :</b><br>
  Obveze ${u === "učiteljica" ? "učiteljice" : "učitelja"} proizlaze iz odredbi Godišnjeg plana i programa rada Škole i Školskog kurikuluma,
  a utvrđuju se sukladno odredbama Zakona o odgoju i obrazovanju u osnovnoj i srednjoj školi, Pravilnika o tjednim radnim obvezama
  učitelja i stručnih suradnika u osnovnoj školi i Kolektivnog ugovora za zaposlenike u osnovnoškolskim ustanovama.
  Slijedom navedenoga ${u} se zadužuje u školskoj godini ${esc(cfg.godina)} tjednim i godišnjim radnim obvezama kako je navedeno u izreci ove Odluke.</p>

  <p class="obr"><b>UPUTA O PRAVNOM LIJEKU:</b> Protiv ove Odluke radnik može podnijeti zahtjev za zaštitu prava odnosno prigovor Školskom odboru
  u roku od 15 dana od dana dostave Odluke. Zahtjev se podnosi u tajništvu škole u pisanom obliku, a može se izjaviti i usmeno na zapisnik.</p>

  <div class="sigs">
    <div class="sigbox">PREUZEO/LA:<div class="sigline">${esc(t.name)}</div></div>
    <div class="sigbox">${rav}:<div class="sigline">${esc(school.ravnatelj)}</div></div>
  </div>

  <p class="dost"><b>Dostaviti:</b><br>
  1.) ${esc(t.name)}<br>
  2.) Upravni odjel za povjerene poslove državne uprave — ${esc(school.zupanija)} županija<br>
  3.) Pismohrana.</p>
</section>`;
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: "Liberation Serif", "Times New Roman", serif; font-size: 10.5pt; color:#000; margin:0; }
  .hdr { font-weight:bold; }
  .meta { margin-top:4px; }
  .just { text-align:justify; margin:12px 0; }
  h1 { text-align:center; letter-spacing:3px; font-size:13pt; margin:14px 0 2px; }
  .subt { text-align:center; margin:0 0 12px; }
  .c { text-align:center; }
  .caption { font-weight:bold; margin:12px 0 2px; }
  table { width:100%; border-collapse:collapse; margin:4px 0 2px; font-size:9.5pt; }
  td { border:1px solid #000; padding:2px 5px; vertical-align:middle; }
  .th td { font-weight:bold; text-align:center; background:#ececec; }
  .sec td { font-weight:bold; background:#f5f5f5; }
  .subtot td { font-weight:bold; background:#eef4fb; }
  .ab td { font-weight:bold; background:#dce9f7; }
  .uk td { font-weight:bold; background:#eee; }
  .recap { width:100%; border-collapse:collapse; margin:4px 0; font-size:9.5pt; }
  .recap td { border:1px solid #000; padding:3px 6px; }
  .recap td:last-child { text-align:right; white-space:nowrap; width:30%; }
  .recap .grand td { font-weight:bold; background:#dce9f7; }
  sup.fn { color:#b00; font-weight:bold; }
  .fn-note { font-size:8.3pt; margin:3px 0 0; line-height:1.35; color:#333; }
  .fn-note.warn { color:#b00; }
  .obr { text-align:justify; margin:10px 0; }
  .sigs { display:flex; justify-content:space-between; gap:20px; margin-top:28px; }
  .sigbox { text-align:center; font-size:9.5pt; }
  .sigline { margin-top:34px; border-top:1px solid #000; padding-top:3px; min-width:60mm; }
  .dost { margin-top:18px; font-size:9.5pt; }
`;

/** CSS for a COMBINED doc: every Odluka on its own page. */
export const PAGE_CSS = `@page { size: A4; margin: 15mm 16mm; } .odluka { page-break-after: always; } ${BASE_CSS}`;

/** CSS for a SINGLE-teacher doc: no forced trailing break (avoids a blank page). */
export const PAGE_CSS_SINGLE = `@page { size: A4; margin: 15mm 16mm; } .odluka { page-break-after: auto; } ${BASE_CSS}`;

const docShell = (css: string, body: string) =>
  `<!doctype html><html lang="hr"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;

/** Full HTML document with every teacher's Odluka (one per page). */
export function combinedDoc(teachers: Teacher[], school: School, cfg: Omit<OdlukaCfg, "urbrojIndex">): string {
  const body = teachers
    .map((t, i) => odlukaHTML(t, school, { ...cfg, urbrojIndex: t.urbrojIndex ?? i + 1 }))
    .join("\n");
  return docShell(PAGE_CSS, body);
}

/** Full HTML document for one teacher's Odluka. */
export function singleDoc(t: Teacher, school: School, cfg: Omit<OdlukaCfg, "urbrojIndex">): string {
  return docShell(PAGE_CSS_SINGLE, odlukaHTML(t, school, { ...cfg, urbrojIndex: t.urbrojIndex ?? 1 }));
}
