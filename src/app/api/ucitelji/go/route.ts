import { getSession } from "@/lib/session";
import { getCurrentSchool } from "@/lib/school";
import { parseStaz } from "@/lib/ucitelji/staz";
import {
  izracunajGodisnji,
  type Kategorija,
  type Rezultati,
  type UvjetKey,
} from "@/lib/ucitelji/godisnji-odmor";
import { singleRjesenjeDoc } from "@/lib/ucitelji/go-html";
import { renderHtmlToPdf } from "@/lib/pdf/render";

// Headless Chrome (PDF) + session (node:crypto) require the Node.js runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

const KATEGORIJE: Kategorija[] = ["I", "II", "III", "ostali"];
const UVJET_KEYS: UvjetKey[] = [
  "posebni_uvjeti", "smjenski", "rad_s_teskocama", "razrednik", "vise_predmeta", "dvije_skole",
];
const REZULTATI: Exclude<Rezultati, null>[] = ["izuzetni", "vrlo_uspjesni", "uspjesni"];

const asciiSlug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "rjesenje";

function fileStream(bytes: Uint8Array, contentType: string, filename: string): Response {
  const CHUNK = 1 << 16;
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      if (offset >= bytes.length) return ctrl.close();
      ctrl.enqueue(bytes.subarray(offset, offset + CHUNK));
      offset += CHUNK;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * POST /api/ucitelji/go — JSON body with one employee's GO criteria.
 * Returns a Rješenje o godišnjem odmoru PDF. School header comes from the
 * session (authoritative), never the client. Nothing is persisted here; the
 * sensitive social criteria live only in this request.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niste prijavljeni." }, { status: 401 });

  const school = await getCurrentSchool();
  if (!school) {
    return Response.json({ error: "Vašem računu nije dodijeljena škola." }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const ime = String(body.ime ?? "").trim().slice(0, 120);
  const prezime = String(body.prezime ?? "").trim().slice(0, 120);
  const zvanje = String(body.zvanje ?? "").trim().slice(0, 200);
  if (!ime && !prezime) {
    return Response.json({ error: "Nedostaje ime zaposlenika." }, { status: 400 });
  }

  const kategorija: Kategorija = KATEGORIJE.includes(body.kategorija as Kategorija)
    ? (body.kategorija as Kategorija)
    : "ostali";

  const uvjetiIn = (body.uvjeti ?? {}) as Record<string, unknown>;
  const uvjeti: Partial<Record<UvjetKey, boolean>> = {};
  for (const k of UVJET_KEYS) if (uvjetiIn[k]) uvjeti[k] = true;

  const soc = (body.socijalni ?? {}) as Record<string, unknown>;
  const toInt = (v: unknown) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 0;
  };
  const rezultati: Rezultati = REZULTATI.includes(body.rezultati as Exclude<Rezultati, null>)
    ? (body.rezultati as Rezultati)
    : null;

  const stazRaw = body.staz_ukupno;
  const staz = parseStaz(stazRaw == null ? "" : String(stazRaw));

  const rezultat = izracunajGodisnji({
    staz,
    kategorija,
    uvjeti,
    brojDjece: toInt(soc.brojDjece),
    djecaSTeskocama: toInt(soc.djecaSTeskocama),
    invaliditet: !!soc.invaliditet,
    samohrani: !!soc.samohrani,
    domovinskiRat: !!soc.domovinskiRat,
    rezultati,
  });

  const godina = String(body.godina ?? "").trim() || String(new Date().getFullYear());
  const klasa = String(body.klasa ?? "").trim();
  const urbroj = String(body.urbroj ?? "").trim();

  try {
    const html = singleRjesenjeDoc(
      { ime, prezime, zvanje, rezultat },
      school,
      { klasa, urbroj, godina, date: new Date() },
    );
    const bytes = await renderHtmlToPdf(html);
    const base = `Rjesenje-GO-${asciiSlug(`${prezime} ${ime}`)}-${godina}`;
    return fileStream(bytes, "application/pdf", `${base}.pdf`);
  } catch (e) {
    console.error("generate GO:", e);
    return Response.json(
      { error: (e as Error).message || "Generiranje nije uspjelo." },
      { status: 500 },
    );
  }
}
