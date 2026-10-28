import "server-only";
import { existsSync } from "node:fs";
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
  return puppeteer.launch({
    executablePath: localChrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

/** Run a job with one browser + one reusable page; always tears the browser down. */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}

/** Render one self-contained HTML document (inline CSS, no external assets) to an A4 PDF. */
export async function renderHtmlToPdf(html: string): Promise<Uint8Array> {
  return withPage(async (page) => {
    await page.setContent(html, { waitUntil: "load" });
    return page.pdf({ format: "A4", printBackground: true });
  });
}
