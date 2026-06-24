import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Lists and reads the law texts in `src/content/laws/` for the in-app reader.
 * These are the same files used as the RAG ingestion source.
 */

const LAWS_DIR = path.join(process.cwd(), "src", "content", "laws");

export interface LawMeta {
  slug: string;
  title: string;
  file: string;
}

function isLawFile(name: string): boolean {
  if (name.startsWith("_") || name.toLowerCase() === "readme.md") return false;
  return /\.(md|txt)$/i.test(name);
}

function titleOf(file: string): string {
  return file
    .replace(/\.(md|txt)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s: string): string {
  return s
    .normalize("NFD") // decomposes č/ć/š/ž into base letter + combining mark
    .replace(/\p{Diacritic}/gu, "") // remove the combining marks
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** All laws, sorted by title, each with a URL slug. */
export async function listLaws(): Promise<LawMeta[]> {
  const files = (await readdir(LAWS_DIR)).filter(isLawFile);
  return files
    .map((file) => ({ file, title: titleOf(file), slug: slugify(titleOf(file)) }))
    .sort((a, b) => a.title.localeCompare(b.title, "hr"));
}

/** Full text + title for one law, or null if the slug is unknown. */
export async function getLaw(
  slug: string,
): Promise<{ title: string; text: string } | null> {
  const law = (await listLaws()).find((l) => l.slug === slug);
  if (!law) return null;
  const text = await readFile(path.join(LAWS_DIR, law.file), "utf8");
  return { title: law.title, text };
}
