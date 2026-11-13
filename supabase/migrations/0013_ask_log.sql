-- 0013_ask_log.sql
-- Log of every AI question a principal asked and the answer they received, so
-- the admin (owner) has insight: to later build a curated Q&A, and to have
-- context when a principal calls to go deeper on a topic.
--
-- Service-role-only (RLS on, no policies) — same lockdown as feedback/ai_usage.
-- The question text a principal types MAY contain names, so this table is
-- treated like other internal data: never exposed to the browser API role, and
-- never sent to the AI (the AI only ever receives the question + public law).
create table if not exists public.ask_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.users(id) on delete set null,
  school_id  uuid references public.schools(id) on delete set null,
  username   text,                 -- snapshot for quick reading
  school     text,                 -- snapshot for quick reading
  pitanje    text not null,        -- the principal's question
  odgovor    text,                 -- the AI answer that was streamed back
  izvori     jsonb,                -- cited sources: [{slug,title,article}]
  napomena   text,                 -- admin's own note (for building Q&A / calls)
  status     text not null default 'novo',  -- novo | pregledano
  created_at timestamptz not null default now()
);

create index if not exists ask_log_created_idx on public.ask_log (created_at desc);
create index if not exists ask_log_school_idx on public.ask_log (school_id);

alter table public.ask_log enable row level security;

-- Reload PostgREST schema cache so the new table is visible:
--   NOTIFY pgrst, 'reload schema';
