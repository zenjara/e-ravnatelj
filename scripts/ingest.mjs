// scripts/ingest.mjs
// Build the RAG store: split each law into article (članak) chunks, embed them
// with Gemini, and load them into the `law_chunks` table.
//
// Run:  npm run ingest
//   (node --env-file=.env.local scripts/ingest.mjs)
//
// Idempotent: clears law_chunks and rebuilds. Requires 0002_law_chunks.sql applied.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
const EMBED_DIM = 768;
// Batch by TOKENS. The free tier's binding limit is RPD (1000 requests/day), so
// pack each request as full as the per-minute token cap allows to minimize the
// number of requests. Stay just under TPM so we don't trip per-minute 429s.
const MAX_BATCH_TOKENS = Number(process.env.EMBED_BATCH_TOKENS ?? 6000); // tokens per request (under the per-request cap)
const MAX_BATCH_ITEMS = 100; // API cap on contents per request
const EMBED_TPM = Number(process.env.EMBED_TPM ?? 28000); // pace under your tokens-per-minute limit (free TPM=30k)
const EMBED_TPS = EMBED_TPM / 60;
const estTokens = (texts) => Math.ceil(texts.reduce((s, t) => s + t.length, 0) / 4);
const estChunkTokens = (c) => Math.ceil(c.content.length / 4);

/** Group chunks into batches bounded by token count (and item count). */
function tokenBatches(items) {
  const out = [];
  let cur = [];
  let toks = 0;
  for (const c of items) {
    const t = estChunkTokens(c);
    if (cur.length && (toks + t > MAX_BATCH_TOKENS || cur.length >= MAX_BATCH_ITEMS)) {
      out.push(cur);
      cur = [];
      toks = 0;
    }
    cur.push(c);
    toks += t;
  }
  if (cur.length) out.push(cur);
  return out;
}
const MAX_CHUNK_CHARS = 4000; // split longer articles/annexes into sub-chunks
const MAX_EMBED_CHARS = 8000; // hard ceiling for embedding input

const LAWS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "content",
  "laws",
);

const ARTICLE_RE = /^\s*Članak\s+(\d+[a-z]?)\b/i;
const SECTION_RE = /^\s*[IVXLC]+\.\s+\S/; // roman-numeral section headings

function env(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`\n✗ Missing ${name}. Run via "npm run ingest" (loads .env.local).\n`);
    process.exit(1);
  }
  return v;
}

function sourceName(file) {
  return file
    .replace(/\.(md|txt)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split one law's text into { article, heading, content } chunks by članak. */
function chunkLaw(source, text) {
  const lines = text.split("\n");
  const chunks = [];
  let heading = null;
  let cur = null; // { article, heading, lines: [] }

  const flush = () => {
    if (!cur) return;
    const content = cur.lines.join("\n").trim();
    if (content) chunks.push({ source, article: cur.article, heading: cur.heading, content });
    cur = null;
  };

  for (const line of lines) {
    if (SECTION_RE.test(line) && !ARTICLE_RE.test(line)) {
      heading = line.trim();
    }
    const m = line.match(ARTICLE_RE);
    if (m) {
      flush();
      cur = { article: m[1], heading, lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    } else {
      // preamble before the first article (title, NN refs) → keep as one chunk
      cur = { article: "(uvod)", heading: null, lines: [line] };
    }
  }
  flush();
  return chunks.flatMap((c) => splitLong(c));
}

/**
 * Split an over-long chunk (e.g. a huge annex or a very long article) into
 * sub-chunks at line boundaries. The `article` metadata is preserved, so the
 * citation label is kept even for continuation parts.
 */
function splitLong(chunk, limit = MAX_CHUNK_CHARS) {
  if (chunk.content.length <= limit) return [chunk];
  const parts = [];
  let buf = "";
  for (const line of chunk.content.split("\n")) {
    if (buf && buf.length + line.length + 1 > limit) {
      parts.push(buf);
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
    // hard-split a single very long line
    while (buf.length > limit * 1.5) {
      parts.push(buf.slice(0, limit));
      buf = buf.slice(limit);
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts.map((content) => ({ ...chunk, content: content.trim() }));
}

function normalize(v) {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry 429s indefinitely. A single 429 means we've exceeded the per-minute
// window, so wait a full 60s to let it clear, then retry — never give up.
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
      if (!/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) throw e;
      console.log("  rate limited, waiting 60s…");
      await sleep(60000);
    }
  }
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  env("GEMINI_API_KEY");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 1. Collect chunks from every law file.
  const files = (await readdir(LAWS_DIR)).filter(
    (f) => /\.(md|txt)$/i.test(f) && !f.startsWith("_") && f.toLowerCase() !== "readme.md",
  );
  const chunks = [];
  for (const f of files.sort()) {
    const text = await readFile(path.join(LAWS_DIR, f), "utf8");
    const c = chunkLaw(sourceName(f), text);
    chunks.push(...c);
  }
  // Stable identity per chunk so re-runs are idempotent/resumable.
  const keyOf = (c) =>
    createHash("md5").update(`${c.source}${c.article}${c.content}`).digest("hex");
  console.log(`Total: ${chunks.length} chunks from ${files.length} files`);

  // 2. Skip chunks already embedded (resume after a rate-limit stop).
  const done = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("law_chunks")
      .select("source, article, content")
      .range(from, from + 999);
    if (error) {
      console.error("✗ read existing failed:", error.message);
      if (/relation .*law_chunks.* does not exist|schema cache/i.test(error.message)) {
        console.error("  → Run supabase/migrations/0002_law_chunks.sql first.");
      }
      process.exit(1);
    }
    for (const r of data) done.add(keyOf(r));
    if (data.length < 1000) break;
  }
  const todo = chunks.filter((c) => !done.has(keyOf(c)));
  console.log(`Already embedded: ${done.size}. Remaining: ${todo.length}.`);
  if (todo.length === 0) {
    console.log("\n✓ Nothing to do — store is up to date.");
    return;
  }

  // 3. Embed + insert in token-bounded batches (insert immediately so progress survives a stop).
  const batchList = tokenBatches(todo);
  console.log(`Embedding in ${batchList.length} batches (≤${MAX_BATCH_TOKENS} tok each), pacing ≤${EMBED_TPM} tok/min.`);
  let inserted = 0;
  for (let b = 0; b < batchList.length; b++) {
    const batch = batchList[b];
    const texts = batch.map((c) => c.content);
    const vecs = await embedBatch(ai, texts);
    const rows = batch.map((c, j) => ({
      source: c.source,
      article: c.article,
      heading: c.heading,
      content: c.content,
      embedding: `[${vecs[j].join(",")}]`, // pgvector text format
    }));
    const { error } = await supabase.from("law_chunks").insert(rows);
    if (error) {
      console.error("✗ insert failed:", error.message);
      process.exit(1);
    }
    inserted += rows.length;
    console.log(`  ${inserted}/${todo.length} (total in store: ${done.size + inserted})`);
    // Pace to stay under the per-minute token budget.
    if (b < batchList.length - 1) {
      await sleep((estTokens(texts) / EMBED_TPS) * 1000);
    }
  }

  console.log(`\n✓ Ingested ${inserted} new chunks (store total: ${done.size + inserted}).`);
}

main().catch((e) => {
  console.error("\n✗ Unexpected error:", e);
  process.exit(1);
});
