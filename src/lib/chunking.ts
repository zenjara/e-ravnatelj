import "server-only";

/**
 * Split a law's text into per-article (članak) chunks, sub-splitting any chunk
 * that is too long. Mirrors scripts/ingest.mjs so app-side re-ingestion and the
 * bulk ingest script produce identical chunks.
 */

const MAX_CHUNK_CHARS = 4000;
const ARTICLE_RE = /^\s*Članak\s+(\d+[a-z]?)\b/i;
const SECTION_RE = /^\s*[IVXLC]+\.\s+\S/;

export interface LawChunk {
  article: string;
  heading: string | null;
  content: string;
}

function splitLong(chunk: LawChunk, limit = MAX_CHUNK_CHARS): LawChunk[] {
  if (chunk.content.length <= limit) return [chunk];
  const parts: string[] = [];
  let buf = "";
  for (const line of chunk.content.split("\n")) {
    if (buf && buf.length + line.length + 1 > limit) {
      parts.push(buf);
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
    while (buf.length > limit * 1.5) {
      parts.push(buf.slice(0, limit));
      buf = buf.slice(limit);
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts.map((content) => ({ ...chunk, content: content.trim() }));
}

export function chunkLaw(text: string): LawChunk[] {
  const lines = text.split("\n");
  const chunks: LawChunk[] = [];
  let heading: string | null = null;
  let cur: { article: string; heading: string | null; lines: string[] } | null = null;

  const flush = () => {
    if (!cur) return;
    const content = cur.lines.join("\n").trim();
    if (content) chunks.push({ article: cur.article, heading: cur.heading, content });
    cur = null;
  };

  for (const line of lines) {
    if (SECTION_RE.test(line) && !ARTICLE_RE.test(line)) heading = line.trim();
    const m = line.match(ARTICLE_RE);
    if (m) {
      flush();
      cur = { article: m[1], heading, lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    } else {
      cur = { article: "(uvod)", heading: null, lines: [line] };
    }
  }
  flush();
  return chunks.flatMap((c) => splitLong(c));
}
