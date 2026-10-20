import type { School, Teacher, Duty } from "./parse";

/**
 * HTML for one Odluka o godišnjim i tjednim zaduženjima (A4, print-ready).
 * Canonical layout from the father's verified examples; fixed legal references
 * are the current ones. Ported from the standalone prototype.
 */

export interface OdlukaCfg {
  klasa: string;
  urbrojBase: string;
  godina: string;
  date: Date;
  urbrojIndex: number;
  annualFull?: number; // puna godišnja norma (default 1784)
}

const MJ = [
  "siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja",
  "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca",
];
const dateHr = (d: Date) => `${d.getDate()}. ${MJ[d.getMonth()]} ${d.getFullYear()}.`;
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (x: unknown): string | number =>
  x == null || x === "" ? "" : Math.round(Number(x) * 100) / 100;
const god = (j: number) => (j ? n(Math.round(j * 35 * 100) / 100) : "");

function rolePhrase(t: Teacher): string {
  const u = t.female ? "učiteljice" : "učitelja";
  if (/razredna nastava/i.test(t.predmet)) return `${u} razredne nastave`;
  return `${u} za nastavni predmet: ${esc(t.predmet)}`;
}

const row = (
  br: string,
  naziv: string,
  { razredi = "", j = "" as number | "", pre = "" }: { razredi?: string; j?: number | ""; pre?: string } = {},
) =>
  `<tr><td class="c">${br}</td><td>${naziv}${pre ? ` <span class="pre">${esc(pre)}</span>` : ""}</td>
   <td class="c">${esc(razredi)}</td><td class="c">${j === "" ? "" : n(j)}</td><td class="c">${j === "" ? "" : god(j as number)}</td></tr>`;
const sec = (txt: string) => `<tr class="sec"><td colspan="5">${txt}</td></tr>`;
const uk = (naziv: string, j: number) =>
  `<tr class="uk"><td colspan="3">${naziv}</td><td class="c">${n(j)}</td><td class="c">${god(j)}</td></tr>`;
const ukK = (naziv: string, j: number, k: number) =>
  `<tr class="uk"><td colspan="3">${naziv}</td><td class="c">${n(j)}</td><td class="c">${n(k)}</td></tr>`;

export function odlukaHTML(t: Teacher, school: School, cfg: OdlukaCfg): string {
  const U = t.female ? "Učiteljica" : "Učitelj";
  const rav = t.female ? "Ravnateljica" : "Ravnatelj";
  const ukupnoPrvi = (t.redovita || 0) + (t.izborna || 0) + (t.razr_sati || 0);
  const ostaliTotal = (t.ukupno_tjedno || 0) - (t.ukupno_noor || 0);
  const ostaliOstalo = ostaliTotal - (t.pripremanje || 0) - (t.ostali_razrednik || 0);
  const annualFull = cfg.annualFull || 1784;
  const totalAnnual = Math.round((t.ukupno_tjedno / 40) * annualFull);
  const noorAnnual = Math.round((t.ukupno_noor || 0) * 35);
  const ostaliAnnual = totalAnnual - noorAnnual;
  const ostaliGodOnly = Math.round((ostaliAnnual - ostaliTotal * 35) * 100) / 100;
  const puno = /PUNO/i.test(t.radno_vrijeme) && !/NEPUNO/i.test(t.radno_vrijeme);
  const urbroj = `${cfg.urbrojBase}-${cfg.urbrojIndex}`;
  const teachClass = (/razredna nastava/i.test(t.predmet) || t.razrednistvo) ? t.razrednistvo : t.predmet;
  const cl13 = t.cl13_7 || [], cl8 = t.cl8 || [], ku = t.ku || [];
  const sumD = (a: Duty[]) => a.reduce((s, d) => s + d.h, 0);
  const names = (a: Duty[]) => (a.length ? ": " + a.map((d) => esc(d.name)).join(", ") : "");
  const kuRows: Duty[] = [
    ...ku,
    ...(t.umanjenje ? [{ name: "Umanjenje radne obveze (čl. 38. st. 1. KU)", h: t.umanjenje }] : []),
  ];

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
  <p class="c sub">o godišnjim i tjednim zaduženjima učitelja u školskoj godini ${esc(cfg.godina)}</p>

  <p><b>1.)</b> ${U} <b>${esc(t.name)}</b></p>
  <p class="ind">zadužuje se u šk. god. ${esc(cfg.godina)} obvezama ${rolePhrase(t)},
  razredništvom <b>${t.razrednistvo ? esc(t.razrednistvo) : "/"}</b>, posebnim, drugim i ostalim poslovima kako je navedeno.</p>

  <p><b>2.)</b> Obveze iz točke prve ${t.female ? "učiteljica" : "učitelj"} će obavljati u <b>${puno ? "punom" : "nepunom"}</b>
  radnom vremenu od <b>${n(t.ukupno_tjedno)}</b> sati tjedno.</p>

  <table>
    <tr class="th"><td class="c">R.br.</td><td>Vrsta rada</td><td class="c">Razredni odjeli</td><td class="c">Sati tjedno</td><td class="c">Sati godišnje</td></tr>
    ${sec("1. NEPOSREDNI ODGOJNO-OBRAZOVNI RAD S UČENICIMA")}
    ${row("1.", "Redovita nastava", { razredi: t.razredi, j: t.redovita })}
    ${row("2.", "Izborna nastava", { j: t.izborna })}
    ${row("3.", "Neposredni odgojno-obrazovni rad razrednika", { razredi: t.razrednistvo, j: t.razr_sati })}
    ${row("4.", "Poslovi u sklopu tjedne obveze (čl. 13. st. 7. Pravilnika)" + names(cl13), { j: sumD(cl13) })}
    ${row("5.", "Poslovi koji proizlaze iz ustroja rada škole (čl. 8. Pravilnika)" + names(cl8), { j: sumD(cl8) })}
    ${uk("UKUPNO", t.ab || ukupnoPrvi)}
    ${row("6.", "Dopunska nastava", { razredi: t.dop ? teachClass : "", j: t.dop })}
    ${row("7.", "Dodatni rad", { razredi: t.dod ? teachClass : "", j: t.dod })}
    ${row("8.", "Izvannastavna aktivnost", { j: t.ina })}
    ${sec("2. DRUGI POSLOVI NA TEMELJU KOLEKTIVNOG UGOVORA (čl. 8.a Pravilnika)")}
    ${kuRows.length ? kuRows.map((d, i) => row(`${9 + i}.`, esc(d.name), { j: d.h })).join("\n    ") : row("9.", "Zaštita na radu / sindikalni povjerenik / umanjenje (čl. 8.a)", { j: 0 })}
    ${uk("UKUPNO NEPOSREDNI ODGOJNO-OBRAZOVNI RAD", t.ukupno_noor)}
    ${sec("3. OSTALI POSLOVI")}
    ${row("1.", "Ostali poslovi vođenja razrednog odjela", { j: t.ostali_razrednik })}
    ${row("2.", "Stručno-metodička priprema", { j: t.pripremanje })}
    ${row("3.", "Ostali poslovi koji proizlaze iz naravi i količine neposrednog rada", { j: ostaliOstalo })}
    ${ostaliGodOnly ? `<tr><td class="c">4.</td><td>Ostali poslovi tijekom cijele školske godine (nenastavni dani i dr.)</td><td class="c"></td><td class="c"></td><td class="c">${n(ostaliGodOnly)}</td></tr>` : ""}
    ${ukK("UKUPNO OSTALI POSLOVI", ostaliTotal, ostaliAnnual)}
    <tr class="sve"><td colspan="3">S V E U K U P N O (1+2+3)</td><td class="c">${n(t.ukupno_tjedno)}</td><td class="c">${n(totalAnnual)}</td></tr>
  </table>

  <p class="obr"><b>O b r a z l o ž e nj e :</b><br>
  Obveze ${t.female ? "učiteljice" : "učitelja"} proizlaze iz odredbi Godišnjeg plana i programa rada Škole i Školskog kurikuluma,
  a utvrđuju se sukladno odredbama Zakona o odgoju i obrazovanju u osnovnoj i srednjoj školi, Pravilnika o tjednim radnim obvezama
  učitelja i stručnih suradnika u osnovnoj školi i Kolektivnog ugovora za zaposlenike u osnovnoškolskim ustanovama.
  Slijedom navedenoga ${t.female ? "učiteljica" : "učitelj"} se zadužuje u ${esc(cfg.godina)} školskoj godini tjednim i godišnjim radnim obvezama kako je navedeno u Odluci.</p>

  <p class="obr"><b>UPUTA O PRAVNOM LIJEKU:</b> Protiv ove Odluke radnik može podnijeti zahtjev za zaštitu prava Školskom odboru
  u roku od 15 dana od dana dostave Odluke. Zahtjev se podnosi u tajništvu škole u pisanom obliku.</p>

  <div class="sig"><div>${rav}:<br><br>_______________________<br>${esc(school.ravnatelj)}</div></div>

  <p class="dost"><b>Dostaviti:</b><br>1.) ${esc(t.name)}<br>2.) ${esc(school.zupanija)} županija<br>3.) pismohrana.</p>
</section>`;
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: "Liberation Serif", "Times New Roman", serif; font-size: 10.5pt; color:#000; margin:0; }
  .hdr { font-weight:bold; }
  .meta { margin-top:4px; }
  .just { text-align:justify; margin:12px 0; }
  h1 { text-align:center; letter-spacing:3px; font-size:13pt; margin:14px 0 2px; }
  .sub { margin:0 0 12px; } .c { text-align:center; } .ind { margin-left:18px; }
  table { width:100%; border-collapse:collapse; margin:8px 0; font-size:9.5pt; }
  td { border:1px solid #000; padding:2px 4px; vertical-align:middle; }
  .th td { font-weight:bold; text-align:center; background:#f0f0f0; }
  .sec td { font-weight:bold; background:#f7f7f7; }
  .uk td { font-weight:bold; } .sve td { font-weight:bold; background:#eee; }
  .pre { font-style:italic; color:#333; }
  .obr { text-align:justify; margin:10px 0; }
  .sig { margin-top:26px; text-align:right; } .sig div { display:inline-block; text-align:center; }
  .dost { margin-top:22px; font-size:9.5pt; }
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
