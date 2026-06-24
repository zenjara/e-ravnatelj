// scripts/dump-chunks.mjs
// Export law_chunks (text + embeddings) to a gzipped SQL file so the vector
// store can be restored without re-embedding (no API calls / cost).
//
// Run:    npm run dump:chunks
// Import: gunzip -c supabase/law_chunks_dump.sql.gz | psql "<connection-string>"
//   (or paste the unzipped SQL into the Supabase SQL editor)
//
// Requires 0002_law_chunks.sql applied (table must exist). Starts with TRUNCATE.

import { createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "law_chunks_dump.sql.gz",
);

const q = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);

function env(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} (run via npm run dump:chunks).`);
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

  const gzip = createGzip();
  gzip.pipe(createWriteStream(OUT));
  gzip.write("-- law_chunks dump — restore with: gunzip -c | psql, or paste into SQL editor\n");
  gzip.write("truncate table public.law_chunks;\n");

  let total = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("law_chunks")
      .select("source, article, heading, content, embedding")
      .range(from, from + 999)
      .order("id");
    if (error) {
      console.error("read failed:", error.message);
      process.exit(1);
    }
    for (const r of data) {
      // embedding comes back as a pgvector text string like "[0.1,0.2,...]"
      gzip.write(
        `insert into public.law_chunks (source, article, heading, content, embedding) values (` +
          `${q(r.source)}, ${q(r.article)}, ${q(r.heading)}, ${q(r.content)}, ${q(r.embedding)});\n`,
      );
    }
    total += data.length;
    if (data.length < 1000) break;
  }

  await new Promise((res) => gzip.end(res));
  console.log(`✓ Dumped ${total} rows → ${OUT}`);
}

main().catch((e) => {
  console.error("dump error:", e);
  process.exit(1);
});
