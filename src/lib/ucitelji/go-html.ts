import type { GoRezultat } from "./godisnji-odmor";

/**
 * HTML za Rješenje o godišnjem odmoru (A4, print-ready, self-contained CSS).
 * Pravna osnova: Zakon o radu + Kolektivni ugovor za zaposlenike u
 * osnovnoškolskim ustanovama. ⚠️ Brojevi NN izmjena — provjeriti aktualne.
 */

export interface RjesenjeSkola {
  naziv: string;
  mjesto: string | null;
  zupanija: string | null;
  ravnatelj: string | null;
}

export interface RjesenjeCfg {
  klasa: string;
  urbroj: string;
  /** Kalendarska godina na koju se odnosi godišnji odmor, npr. "2026". */
  godina: string;
  date: Date;
}

export interface RjesenjeZaposlenik {
  ime: string;
  prezime: string;
  zvanje: string;
  rezultat: GoRezultat;
}

const MJ = [
  "siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja",
  "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca",
];
const dateHr = (d: Date) => `${d.getDate()}. ${MJ[d.getMonth()]} ${d.getFullYear()}.`;
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function rjesenjeHTML(
  z: RjesenjeZaposlenik,
  school: RjesenjeSkola,
  cfg: RjesenjeCfg,
): string {
  const ime = `${z.ime} ${z.prezime}`.trim();
  const r = z.rezultat;
  const stavke = r.stavke
    .map((s) => `<tr><td>${esc(s.label)}</td><td class="c">${s.dani}</td></tr>`)
    .join("\n    ");

  const napomenaMax = r.odrezanoMax
    ? `<p class="note">Zbroj po kriterijima iznosi ${r.zbroj} dana, no ukupno trajanje godišnjeg odmora ograničeno je na najviše 30 radnih dana sukladno Kolektivnom ugovoru.</p>`
    : r.podignutoMin
      ? `<p class="note">Zbroj po kriterijima iznosi ${r.zbroj} dana te je uvećan na zakonski najmanje trajanje od 20 radnih dana (4 tjedna) sukladno Zakonu o radu.</p>`
      : "";

  return `<section class="rj">
  <div class="hdr">${esc(school.naziv.toUpperCase())}</div>
  <div class="meta">KLASA: ${esc(cfg.klasa)}<br>URBROJ: ${esc(cfg.urbroj)}</div>
  <div class="meta">U ${esc(school.mjesto ?? "")}, ${dateHr(cfg.date)} godine</div>

  <p class="just">${school.ravnatelj ? "Ravnatelj/ica" : "Ravnatelj/ica"} ${esc(school.naziv)}, na temelju članka 77. i 78. Zakona o radu
  (Narodne novine, broj 93/14, 127/17, 98/19, 151/22 i 64/23) te odredaba Kolektivnog ugovora za zaposlenike u osnovnoškolskim
  ustanovama o trajanju godišnjeg odmora, donosi</p>

  <h1>R J E Š E NJ E</h1>
  <p class="c sub">o godišnjem odmoru za ${esc(cfg.godina)}. godinu</p>

  <p><b>1.</b> Zaposleniku/ci <b>${esc(ime)}</b>${z.zvanje ? `, ${esc(z.zvanje)}` : ""}, utvrđuje se pravo na
  godišnji odmor za ${esc(cfg.godina)}. godinu u trajanju od <b>${r.ukupno} radnih dana</b>.</p>

  <p><b>2.</b> Godišnji odmor iz točke 1. zaposlenik/ca koristi prema rasporedu korištenja godišnjih odmora, u dogovoru s poslodavcem.</p>

  <p class="obr"><b>O b r a z l o ž e nj e :</b><br>
  Trajanje godišnjeg odmora utvrđeno je prema kriterijima iz Kolektivnog ugovora za zaposlenike u osnovnoškolskim ustanovama kako slijedi:</p>

  <table>
    <tr class="th"><td>Kriterij</td><td class="c">Radni dani</td></tr>
    ${stavke}
    <tr class="uk"><td>UKUPNO</td><td class="c">${r.ukupno}</td></tr>
  </table>
  ${napomenaMax}

  <p class="obr"><b>UPUTA O PRAVNOM LIJEKU:</b> Protiv ovog Rješenja zaposlenik/ca može podnijeti zahtjev za zaštitu prava
  Školskom odboru u roku od 15 dana od dana dostave. Zahtjev se podnosi u tajništvu škole u pisanom obliku.</p>

  <div class="sig"><div>Ravnatelj/ica:<br><br>_______________________<br>${esc(school.ravnatelj ?? "")}</div></div>

  <p class="dost"><b>Dostaviti:</b><br>1.) ${esc(ime)}<br>2.) pismohrana.</p>
</section>`;
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: "Liberation Serif", "Times New Roman", serif; font-size: 11pt; color:#000; margin:0; }
  .hdr { font-weight:bold; }
  .meta { margin-top:4px; }
  .just { text-align:justify; margin:12px 0; }
  h1 { text-align:center; letter-spacing:3px; font-size:14pt; margin:16px 0 2px; }
  .sub { margin:0 0 14px; } .c { text-align:center; }
  table { width:100%; border-collapse:collapse; margin:8px 0; font-size:10.5pt; }
  td { border:1px solid #000; padding:3px 6px; vertical-align:middle; }
  .th td { font-weight:bold; text-align:center; background:#f0f0f0; }
  .uk td { font-weight:bold; background:#eee; }
  .obr { text-align:justify; margin:12px 0 6px; }
  .note { text-align:justify; margin:6px 0; font-size:10pt; color:#222; }
  .sig { margin-top:30px; text-align:right; } .sig div { display:inline-block; text-align:center; }
  .dost { margin-top:24px; font-size:10pt; }
`;

const PAGE_CSS = `@page { size: A4; margin: 15mm 16mm; } .rj { page-break-after: always; } ${BASE_CSS}`;
const PAGE_CSS_SINGLE = `@page { size: A4; margin: 15mm 16mm; } .rj { page-break-after: auto; } ${BASE_CSS}`;

const docShell = (css: string, body: string) =>
  `<!doctype html><html lang="hr"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;

/** Jedno Rješenje (jedan zaposlenik). */
export function singleRjesenjeDoc(
  z: RjesenjeZaposlenik,
  school: RjesenjeSkola,
  cfg: RjesenjeCfg,
): string {
  return docShell(PAGE_CSS_SINGLE, rjesenjeHTML(z, school, cfg));
}

/** Više Rješenja u jednom dokumentu (po jedno na stranicu). */
export function combinedRjesenjeDoc(
  people: { z: RjesenjeZaposlenik; cfg: RjesenjeCfg }[],
  school: RjesenjeSkola,
): string {
  const body = people.map(({ z, cfg }) => rjesenjeHTML(z, school, cfg)).join("\n");
  return docShell(PAGE_CSS, body);
}
