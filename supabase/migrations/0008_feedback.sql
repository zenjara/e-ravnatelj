-- 0008_feedback.sql
-- Beta feedback: principals send suggestions / bug reports / questions from the
-- floating widget present on every /app screen. Service-role-only (RLS on, no
-- policies). No PII beyond what the principal chooses to type; user_id/school_id
-- are kept for follow-up, with name/school snapshots for quick reading.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  username text,
  school text,
  kategorija text not null default 'prijedlog',
  poruka text not null,
  stranica text,
  status text not null default 'novo',
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
