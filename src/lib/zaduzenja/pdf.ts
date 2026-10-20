import "server-only";
import { existsSync } from "node:fs";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import JSZip from "jszip";
import type { ParsedTable, Teacher } from "./parse";
import { combinedDoc, singleDoc, type OdlukaCfg } from "./odluka-html";

/** School-entered header values + the generation date. */
export type GenCfg = Pick<OdlukaCfg, "klasa" | "urbrojBase" | "godina" | "date">;

const isServerless = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.AWS_EXECUTION_ENV
);

function localChrome(): string {
  const fromEnv = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      "Lokalno nije pronađen Chrome za generiranje PDF-a. Postavi CHROME_PATH na putanju do Chromea.",
    );
  }
  return found;
}

/** Launch a headless browser: @sparticuz/chromium on Vercel, system Chrome locally. */
async function launch(): Promise<Browser> {
  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: chromium.defaultViewport,
    });
  }
  return puppeteer.launch({
    executablePath: localChrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

async function renderOn(page: Page, html: string): Promise<Uint8Array> {
  // The HTML is fully self-contained (inline CSS, no external assets), so
  // "load" is enough — setContent doesn't accept the networkidle variants.
  await page.setContent(html, { waitUntil: "load" });
  return page.pdf({ format: "A4", printBackground: true });
}

/** Run a job with one browser + one reusable page; always tears the browser down. */
async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
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
  return withPage((page) => renderOn(page, html));
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
