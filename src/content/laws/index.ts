import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Loads the full text of the law(s) from this folder and concatenates it for
 * use as model context. There is NO database / RAG — the whole corpus is sent
 * with each request (see project brief).
 *
 * Drop a new `.md` or `.txt` file in this folder and it is picked up
 * automatically. `README.md` and files starting with `_` are ignored.
 *
 * The result is cached for the lifetime of the server process since the law
 * text is static.
 */

const LAWS_DIR = path.join(process.cwd(), "src", "content", "laws");
const TEXT_EXTENSIONS = new Set([".md", ".txt"]);

export interface LawCorpus {
  /** Concatenated text of all law files, ready to embed in the prompt. */
  text: string;
  /** File names included, in order — useful for debugging / display. */
  sources: string[];
}

let cache: LawCorpus | null = null;

function isLawFile(name: string): boolean {
  if (name.startsWith("_") || name.toLowerCase() === "readme.md") return false;
  return TEXT_EXTENSIONS.has(path.extname(name).toLowerCase());
}

export async function loadLawCorpus(): Promise<LawCorpus> {
  if (cache) return cache;

  const entries = (await readdir(LAWS_DIR)).filter(isLawFile).sort();

  const parts: string[] = [];
  for (const name of entries) {
    const content = (await readFile(path.join(LAWS_DIR, name), "utf8")).trim();
    if (content) {
      parts.push(`===== IZVOR: ${name} =====\n\n${content}`);
    }
  }

  cache = {
    text: parts.join("\n\n\n"),
    sources: entries,
  };
  return cache;
}
