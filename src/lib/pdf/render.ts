import "server-only";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

/**
 * Shared headless-Chrome → PDF helper: @sparticuz/chromium on Vercel, system
 * Chrome locally. Mirrors the launch logic used by the Odluke generator.
 */

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
  // Isolated profile so launching the system Chrome doesn't hand off to an
  // already-running instance (which exits immediately → puppeteer times out
  // "waiting for the WS endpoint URL").
  const userDataDir = mkdtempSync(path.join(tmpdir(), "eravnatelj-pdf-"));
  return puppeteer.launch({
    executablePath: localChrome(),
    headless: true,
    timeout: 60000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });
}

/**
 * One long-lived browser, reused across requests. Launching Chrome is the slow
 * part (~2–4 s); keeping it warm means only the first PDF pays that cost. The
 * cache is reset if the browser disconnects (crash, platform teardown) so the
 * next call relaunches cleanly.
 */
let cached: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (cached) {
    try {
      const b = await cached;
      if (b.connected) return b;
    } catch {
      // launch had failed — fall through and try again
    }
  }
  cached = launch();
  const browser = await cached;
  browser.on("disconnected", () => { cached = null; });
  return browser;
}

/** Run a job on the shared browser with a fresh page; closes the PAGE, keeps the browser warm. */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Render one self-contained HTML document (inline CSS, no external assets) to an A4 PDF. */
export async function renderHtmlToPdf(html: string): Promise<Uint8Array> {
  return withPage(async (page) => {
    // The HTML is fully self-contained (inline CSS, no external assets), so we
    // don't need to wait for network — DOMContentLoaded is enough and faster.
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    return page.pdf({ format: "A4", printBackground: true });
  });
}
