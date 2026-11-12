import "server-only";
import type { Page } from "puppeteer-core";
import JSZip from "jszip";
import type { ParsedTable, Teacher } from "./parse";
import { combinedDoc, singleDoc, type OdlukaCfg } from "./odluka-html";
import { withPage, renderHtmlToPdf } from "@/lib/pdf/render";

/** School-entered header values + the generation date + annual-leave days. */
export type GenCfg = Pick<OdlukaCfg, "klasa" | "urbrojBase" | "godina" | "date" | "godisnjiDana">;

async function renderOn(page: Page, html: string): Promise<Uint8Array> {
  // The HTML is fully self-contained (inline CSS, no external assets), so
  // DOMContentLoaded is enough and faster than waiting for the network.
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  return page.pdf({ format: "A4", printBackground: true });
}

/** Number each teacher's Odluka 1..N (URBROJ increments by one per decision). */
function number(teachers: Teacher[]): Teacher[] {
  teachers.forEach((t, i) => (t.urbrojIndex = i + 1));
  return teachers;
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "odluka";

/** One combined A4 PDF with every teacher's Odluka (one per page). */
export async function generateCombinedPdf(parsed: ParsedTable, cfg: GenCfg): Promise<Uint8Array> {
  const teachers = number(parsed.teachers);
  const html = combinedDoc(teachers, parsed.school, cfg);
  return renderHtmlToPdf(html);
}

/**
 * A ZIP containing both: the combined `Sve-odluke.pdf` and a `Pojedinacno/`
 * folder with one PDF per teacher. The combined is rendered by Chrome (compact)
 * rather than page-merged, keeping the archive small. Uses DEFLATE so the final
 * payload stays as small as possible (matters for serverless response limits).
 */
export async function generateZip(parsed: ParsedTable, cfg: GenCfg): Promise<Uint8Array> {
  const teachers = number(parsed.teachers);
  const individual: { name: string; index: number; bytes: Uint8Array }[] = [];
  const combined = await withPage(async (page) => {
    for (const t of teachers) {
      const bytes = await renderOn(page, singleDoc(t, parsed.school, cfg));
      individual.push({ name: t.name, index: t.urbrojIndex ?? 0, bytes });
    }
    return renderOn(page, combinedDoc(teachers, parsed.school, cfg));
  });

  const zip = new JSZip();
  zip.file("Sve-odluke.pdf", combined);
  const folder = zip.folder("Pojedinacno")!;
  for (const it of individual) {
    const nn = String(it.index).padStart(2, "0");
    folder.file(`Odluka-${nn}-${slug(it.name)}.pdf`, it.bytes);
  }
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
