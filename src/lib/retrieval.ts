import "server-only";
import { embedQuery } from "@/lib/embeddings";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** One retrieved law article (članak) with its similarity to the query. */
export interface LawChunk {
  id: number;
  source: string;
  article: string | null;
  heading: string | null;
  content: string;
  similarity: number;
}

/**
 * Embed the question and fetch the top-K most relevant article chunks via the
 * Supabase `match_law_chunks` RPC (cosine similarity over pgvector).
 */
export async function retrieveRelevantChunks(
  question: string,
  k = 12,
): Promise<LawChunk[]> {
  const embedding = await embedQuery(question);
  const { data, error } = await getSupabaseAdmin().rpc("match_law_chunks", {
    query_embedding: `[${embedding.join(",")}]`, // pgvector text format
    match_count: k,
  });
  if (error) throw new Error(`Retrieval failed: ${error.message}`);
  return (data ?? []) as LawChunk[];
}

/** Format retrieved chunks as the law-text context passed to the model. */
export function buildContext(chunks: LawChunk[]): string {
  return chunks
    .map((c) => {
      const label =
        c.article && c.article !== "(uvod)" ? `Članak ${c.article}` : "(uvod)";
      return `===== IZVOR: ${c.source} — ${label} =====\n${c.content}`;
    })
    .join("\n\n");
}
