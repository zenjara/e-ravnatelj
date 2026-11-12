// scripts/seed-laws.mjs
// One-time: load the .txt law files into the `laws` table (the runtime source
// of truth). After this, the reader and ingestion read from the DB, and the
// admin "apply change" flow updates the DB.
//
// Run: npm run seed:laws   (requires 0003_admin_law_management.sql applied)

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const LAWS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "content",
  "laws",
);

const titleOf = (f) =>
  path
    .basename(f)
    .replace(/\.(md|txt)$/i, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Category of a law. Authoritative source is the sub-folder it lives in
 * (laws/zakoni/, laws/pravilnici/, laws/kolektivni-ugovori/ or
 * laws/drzavni-pedagoski-standardi/); we fall back to the title for any file
 * still sitting directly in laws/.
 */
const kindOf = (relPath) => {
  const dir = path.dirname(relPath).toLowerCase();
  if (dir.includes("kolektivni")) return "kolektivni-ugovor";
  if (dir.includes("pedagoski")) return "pedagoski-standard";
  if (dir.includes("pravilnici")) return "pravilnik";
  if (dir.includes("zakoni")) return "zakon";
  return /pravilnik/i.test(path.basename(relPath)) ? "pravilnik" : "zakon";
};

/** Recursively collect .md/.txt law files (skips _-prefixed and README.md). */
async function collectLawFiles(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectLawFiles(abs, base)));
    } else if (
      /\.(md|txt)$/i.test(entry.name) &&
      !entry.name.startsWith("_") &&
      entry.name.toLowerCase() !== "readme.md"
    ) {
      out.push(path.relative(base, abs));
    }
  }
  return out;
}

const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function env(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} (run via npm run seed:laws).`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const supabase = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const files = await collectLawFiles(LAWS_DIR);

  const rows = [];
  for (const f of files.sort()) {
    const title = titleOf(f);
    const text = await readFile(path.join(LAWS_DIR, f), "utf8");
    rows.push({
      slug: slugify(title),
      title,
      kind: kindOf(f),
      current_text: text,
    });
  }

  const { error } = await supabase.from("laws").upsert(rows, { onConflict: "slug" });
  if (error) {
    console.error("✗ seed laws failed:", error.message);
    if (/relation .*laws.* does not exist|schema cache/i.test(error.message)) {
      console.error("  → Run supabase/migrations/0003_admin_law_management.sql first.");
    }
    process.exit(1);
  }

  console.log(`✓ Seeded ${rows.length} laws into the laws table.`);
  for (const r of rows) console.log(`  • ${r.slug}  (${r.current_text.length} chars)`);
}

main().catch((e) => {
  console.error("✗ Unexpected error:", e);
  process.exit(1);
});
