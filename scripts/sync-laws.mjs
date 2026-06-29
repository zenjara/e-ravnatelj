// scripts/sync-laws.mjs
// Make the DB exactly match src/content/laws/:
//   - upsert every current file into the `laws` table
//   - remove laws (and their chunks/proposals) whose file was deleted/renamed
//   - re-embed ONLY laws whose text changed (or are new); unchanged ones are skipped
//
// Run: npm run sync:laws

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
const EMBED_DIM = 768;
const MAX_CHUNK_CHARS = 4000;
const MAX_EMBED_CHARS = 8000;
const MAX_BATCH_CHARS = 24000; // ~6k tokens per embed request
const MAX_BATCH_ITEMS = 100;
const ARTICLE_RE = /^\s*Članak\s+(\d+[a-z]?)\b/i;
const SECTION_RE = /^\s*[IVXLC]+\.\s+\S/;

const LAWS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)), "..", "src", "content", "laws",
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function env(n) {
  const v = process.env[n];
  if (!v) { console.error(`Missing ${n} (run via npm run sync:laws).`); process.exit(1); }
  return v;
}
const titleOf = (f) => f.replace(/\.(md|txt)$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
const slugify = (s) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// --- chunking (mirror of ingest.mjs / src/lib/chunking.ts) ---
function splitLong(chunk, limit = MAX_CHUNK_CHARS) {
  if (chunk.content.length <= limit) return [chunk];
  const parts = []; let buf = "";
  for (const line of chunk.content.split("\n")) {
    if (buf && buf.length + line.length + 1 > limit) { parts.push(buf); buf = line; }
    else buf = buf ? `${buf}\n${line}` : line;
    while (buf.length > limit * 1.5) { parts.push(buf.slice(0, limit)); buf = buf.slice(limit); }
  }
  if (buf.trim()) parts.push(buf);
  return parts.map((content) => ({ ...chunk, content: content.trim() }));
}
function chunkLaw(text) {
  const lines = text.split("\n"); const chunks = []; let heading = null; let cur = null;
  const flush = () => { if (cur) { const c = cur.lines.join("\n").trim(); if (c) chunks.push({ article: cur.article, heading: cur.heading, content: c }); cur = null; } };
  for (const line of lines) {
    if (SECTION_RE.test(line) && !ARTICLE_RE.test(line)) heading = line.trim();
    const m = line.match(ARTICLE_RE);
    if (m) { flush(); cur = { article: m[1], heading, lines: [line] }; }
    else if (cur) cur.lines.push(line);
    else cur = { article: "(uvod)", heading: null, lines: [line] };
  }
  flush();
  return chunks.flatMap((c) => splitLong(c));
}

function normalize(v) { let s = 0; for (const x of v) s += x * x; const n = Math.sqrt(s) || 1; return v.map((x) => x / n); }

async function embedBatch(ai, texts) {
  for (;;) {
    try {
      const res = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: texts.map((t) => t.slice(0, MAX_EMBED_CHARS)),
        config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: EMBED_DIM },
      });
      return res.embeddings.map((e) => normalize(e.values));
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) { console.log("  rate limited, waiting 60s…"); await sleep(60000); }
      else if (/50[03]|UNAVAILABLE|INTERNAL|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg)) { console.log("  transient error, retrying in 8s…"); await sleep(8000); }
      else throw e;
    }
  }
}

/** Embed chunks + insert rows for one law. */
async function indexLaw(supabase, ai, title, chunks) {
  const rows = []; let batch = []; let chars = 0;
  const flush = async () => {
    if (!batch.length) return;
    const vecs = await embedBatch(ai, batch.map((c) => c.content));
    batch.forEach((c, i) => rows.push({ source: title, article: c.article, heading: c.heading, content: c.content, embedding: `[${vecs[i].join(",")}]` }));
    batch = []; chars = 0;
  };
  for (const c of chunks) {
    const len = Math.min(c.content.length, MAX_EMBED_CHARS);
    if (batch.length && (chars + len > MAX_BATCH_CHARS || batch.length >= MAX_BATCH_ITEMS)) await flush();
    batch.push(c); chars += len;
  }
  await flush();
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from("law_chunks").insert(rows.slice(i, i + 200));
    if (error) throw new Error(`insert failed for ${title}: ${error.message}`);
  }
  return rows.length;
}

async function main() {
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });

  // 1) Current files → law records.
  const files = (await readdir(LAWS_DIR)).filter((f) => /\.(md|txt)$/i.test(f) && !f.startsWith("_") && f.toLowerCase() !== "readme.md");
  const laws = [];
  for (const f of files.sort()) {
    const text = await readFile(path.join(LAWS_DIR, f), "utf8");
    const title = titleOf(f);
    laws.push({ slug: slugify(title), title, kind: /pravilnik/i.test(title) ? "pravilnik" : "zakon", text });
  }
  const curSlugs = new Set(laws.map((l) => l.slug));
  const curTitles = new Set(laws.map((l) => l.title));

  // 2) Upsert current laws.
  const { error: upErr } = await supabase.from("laws").upsert(
    laws.map((l) => ({ slug: l.slug, title: l.title, kind: l.kind, current_text: l.text })),
    { onConflict: "slug" },
  );
  if (upErr) {
    console.error("✗ upsert laws failed:", upErr.message);
    if (/relation .*laws.* does not exist|schema cache/i.test(upErr.message)) console.error("  → Apply 0003 migration first.");
    process.exit(1);
  }

  // 3) Remove stale laws (file deleted/renamed) + their proposals.
  const { data: dbLaws } = await supabase.from("laws").select("slug");
  const staleSlugs = dbLaws.filter((l) => !curSlugs.has(l.slug)).map((l) => l.slug);
  if (staleSlugs.length) {
    await supabase.from("law_proposals").delete().in("law_slug", staleSlugs);
    await supabase.from("laws").delete().in("slug", staleSlugs);
  }

  // 4) Remove chunks whose law no longer exists (deleted/renamed sources).
  const sources = new Set();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("law_chunks").select("source").range(from, from + 999);
    data.forEach((r) => sources.add(r.source));
    if (data.length < 1000) break;
  }
  let removedSources = 0;
  for (const src of sources) {
    if (!curTitles.has(src)) { await supabase.from("law_chunks").delete().eq("source", src); removedSources++; }
  }

  // 5) Re-embed only laws whose text changed (or are new).
  let nNew = 0, nUpd = 0, nSame = 0;
  for (const law of laws) {
    const newChunks = chunkLaw(law.text);
    const existing = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("law_chunks").select("content").eq("source", law.title).range(from, from + 999);
      existing.push(...data.map((r) => r.content));
      if (data.length < 1000) break;
    }
    const unchanged =
      existing.length === newChunks.length &&
      (() => { const a = existing.slice().sort(); const b = newChunks.map((c) => c.content).sort(); return a.every((x, i) => x === b[i]); })();
    if (existing.length > 0 && unchanged) { nSame++; continue; }

    if (existing.length > 0) { await supabase.from("law_chunks").delete().eq("source", law.title); nUpd++; }
    else nNew++;
    const n = await indexLaw(supabase, ai, law.title, newChunks);
    console.log(`${existing.length ? "~ updated" : "+ new    "}  ${law.title}  (${n} chunks)`);
  }

  console.log(`\n✓ Sync done. laws=${laws.length} | new=${nNew} updated=${nUpd} unchanged=${nSame} | stale-removed=${staleSlugs.length} (${removedSources} chunk-sources)`);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
