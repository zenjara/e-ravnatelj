import { getSession } from "@/lib/session";
import { parseTable } from "@/lib/zaduzenja/parse";
import { generateCombinedPdf, generateZip, type GenCfg } from "@/lib/zaduzenja/pdf";

// Headless Chrome (PDF) + xlsx + session all require the Node.js runtime.
export const runtime = "nodejs";
// Rendering one PDF per teacher can take a while for a big school.
export const maxDuration = 60;

const asciiSlug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "skola";

/**
 * Send the bytes as a streamed body. A streamed response is not subject to the
 * serverless buffered-response size cap, so large ZIPs download reliably.
 */
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
 * POST /api/zaduzenja/generate — multipart body:
 *   { file, klasa, urbrojBase, godina, format: "pdf" | "zip" }
 *
 * Generates the filled Odluke. `pdf` → one combined A4 document (all teachers,
 * one per page). `zip` → combined PDF + a folder of per-teacher PDFs. Nothing is
 * persisted; the uploaded file is read in-memory for this request only.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Odaberite Excel datoteku (.xlsx)." }, { status: 400 });
  }
  const klasa = String(form.get("klasa") ?? "").trim();
  const urbrojBase = String(form.get("urbrojBase") ?? "").trim();
  const godina = String(form.get("godina") ?? "").trim();
  const format = String(form.get("format") ?? "pdf");
  if (!klasa || !urbrojBase || !godina) {
    return Response.json({ error: "Upišite KLASA, URBROJ i školsku godinu." }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = parseTable(buf);
    if (parsed.teachers.length === 0) {
      return Response.json({ error: "U tablici nema učitelja." }, { status: 422 });
    }

    const cfg: GenCfg = { klasa, urbrojBase, godina, date: new Date() };
    const base = `Odluke-${asciiSlug(parsed.school.naziv)}`;

    if (format === "zip") {
      const bytes = await generateZip(parsed, cfg);
      return fileStream(bytes, "application/zip", `${base}.zip`);
    }

    const bytes = await generateCombinedPdf(parsed, cfg);
    return fileStream(bytes, "application/pdf", `${base}.pdf`);
  } catch (e) {
    console.error("generate zaduzenja:", e);
    return Response.json(
      { error: (e as Error).message || "Generiranje nije uspjelo." },
      { status: 500 },
    );
  }
}
