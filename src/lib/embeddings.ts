import "server-only";
import { GoogleGenAI } from "@google/genai";
import { requireServerEnv } from "@/lib/env";

/**
 * Gemini text embeddings, used for retrieval (RAG).
 *
 * The SAME model + dimensionality must be used for documents (ingestion) and
 * queries, otherwise similarity is meaningless. Keep these constants in sync
 * with scripts/ingest.mjs.
 */
export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
export const EMBED_DIM = 768;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: requireServerEnv("GEMINI_API_KEY") });
  }
  return client;
}

/** Normalize to unit length so cosine == dot product and is stable across dims. */
function normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}

/**
 * Embed a single search query. Uses taskType RETRIEVAL_QUERY (asymmetric search:
 * documents are embedded with RETRIEVAL_DOCUMENT during ingestion).
 */
export async function embedQuery(text: string): Promise<number[]> {
  const res = await getClient().models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { taskType: "RETRIEVAL_QUERY", outputDimensionality: EMBED_DIM },
  });
  const values = res.embeddings?.[0]?.values;
  if (!values) throw new Error("Embedding failed: no values returned.");
  return normalize(values);
}

/**
 * Embed document chunks (RETRIEVAL_DOCUMENT) for (re-)ingestion. Batches by an
 * approximate token budget per request to stay under per-request limits.
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const MAX_CHARS = 24000; // ~6k tokens per request
  const MAX_ITEMS = 100;
  const out: number[][] = [];
  let batch: string[] = [];
  let chars = 0;

  const flush = async () => {
    if (!batch.length) return;
    const res = await getClient().models.embedContent({
      model: EMBED_MODEL,
      contents: batch,
      config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: EMBED_DIM },
    });
    for (const e of res.embeddings ?? []) {
      if (!e.values) throw new Error("Embedding failed: no values returned.");
      out.push(normalize(e.values));
    }
    batch = [];
    chars = 0;
  };

  for (const t of texts) {
    const text = t.slice(0, 8000);
    if (batch.length && (chars + text.length > MAX_CHARS || batch.length >= MAX_ITEMS)) {
      await flush();
    }
    batch.push(text);
    chars += text.length;
  }
  await flush();
  return out;
}
