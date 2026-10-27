-- 0007_rokovi.sql
-- Central registry of GLOBAL deadlines ("rokovnik ravnatelja") — the same for all
-- primary schools (set by law / ministry). Admin-maintained; every principal gets
-- them automatically. No PII; these are public legal deadlines.
--
-- Concrete dates are derived from `md` (MM-DD) per school year in code. `rule`
-- distinguishes a truly fixed date from one the ministry sets yearly (refreshed
-- from the official decision). `provjeriti` flags dates still to be confirmed.

create table if not exists public.rokovi (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  naziv         text not null,
  kategorija    text not null,
  md            text not null,                 -- "MM-DD" (provisional) date
  rule          text not null default 'fixed', -- 'fixed' | 'yearly'
  osnova        text,                          -- legal basis
  checklist     jsonb not null default '[]'::jsonb,
  reminder_days integer not null default 14,
  provjeriti    boolean not null default false,
  sort          integer not null default 0,
  aktivan       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS on, no policies → only the server's service_role key reads/writes.
alter table public.rokovi enable row level security;
