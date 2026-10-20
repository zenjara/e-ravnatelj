-- 0004_school_calendar.sql
-- Per-school important dates for the principal's calendar (Dan škole, Dan grada /
-- općine, nenastavni radni dani, …). The fixed school-year framework (nastavni
-- dani, odmori, državni blagdani) lives in code (src/lib/school-calendar.ts);
-- only the dates each school enters itself are stored here.
--
-- Keyed by user_id (the logged-in principal). One date per (user, day).

create table if not exists public.school_dates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  d           date not null,                 -- the calendar day
  label       text not null,                 -- e.g. "Dan škole", "Dan grada"
  created_at  timestamptz not null default now(),
  unique (user_id, d)
);

create index if not exists school_dates_user_idx on public.school_dates (user_id, d);

-- Same lockdown as the other tables: RLS on, no policies → the anon/authenticated
-- API roles get nothing; the server reads/writes with the service_role key.
alter table public.school_dates enable row level security;
