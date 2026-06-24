-- 0002_law_chunks.sql
-- RAG store: one row per law article (članak), with a Gemini embedding.
-- Run in the Supabase SQL editor before `npm run ingest`.

create extension if not exists vector;

create table if not exists public.law_chunks (
  id         bigint generated always as identity primary key,
  source     text not null,            -- law name (derived from file)
  article    text,                     -- e.g. "11", "11.a", or "(uvod)"
  heading    text,                     -- nearest section heading, if any
  content    text not null,            -- the article text
  embedding  vector(768) not null,     -- gemini-embedding-001 @ 768 dims
  created_at timestamptz not null default now()
);

-- Approximate nearest-neighbour index for cosine distance.
create index if not exists law_chunks_embedding_idx
  on public.law_chunks
  using hnsw (embedding vector_cosine_ops);

-- Server-only access (service_role bypasses RLS); no client reads.
alter table public.law_chunks enable row level security;

-- Top-K retrieval by cosine similarity.
create or replace function public.match_law_chunks(
  query_embedding vector(768),
  match_count int default 12
)
returns table (
  id bigint,
  source text,
  article text,
  heading text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.id, c.source, c.article, c.heading, c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.law_chunks c
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
