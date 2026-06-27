import "server-only";
import { chunkLaw } from "@/lib/chunking";
import { embedDocuments } from "@/lib/embeddings";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Re-build the RAG index for a single law: delete its existing chunks, re-chunk
 * the given text per article, re-embed, and insert. Used after a proposal is
 * approved and the law's text is replaced.
 *
 * Chunks are keyed by `source` = the law title (same as bulk ingestion), so this
 * cleanly replaces only this law's rows in `law_chunks`.
 */
export async function reingestLaw(title: string, text: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { error: delErr } = await supabase
    .from("law_chunks")
    .delete()
    .eq("source", title);
  if (delErr) throw new Error(`reingest delete failed: ${delErr.message}`);

  const chunks = chunkLaw(text);
  const vecs = await embedDocuments(chunks.map((c) => c.content));
  const rows = chunks.map((c, i) => ({
    source: title,
    article: c.article,
    heading: c.heading,
    content: c.content,
    embedding: `[${vecs[i].join(",")}]`,
  }));

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from("law_chunks").insert(rows.slice(i, i + 200));
    if (error) throw new Error(`reingest insert failed: ${error.message}`);
  }
  return rows.length;
}
