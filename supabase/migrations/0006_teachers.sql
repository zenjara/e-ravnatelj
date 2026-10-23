-- 0006_teachers.sql
-- Per-school staff roster, populated from an e-Matica staff export the principal
-- uploads (Djelatnici → Popis → Izvoz). Keyed by school_id (set server-side).
--
-- PII stays minimal: name + job position only. NO OIB is stored even though the
-- e-Matica export contains it — it is dropped at parse time. No student data.

create table if not exists public.teachers (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  prezime      text,
  ime          text,
  radno_mjesto text,                      -- role / subject (as exported)
  izvor        text not null default 'e-matica',
  created_at   timestamptz not null default now()
);

create index if not exists teachers_school_idx on public.teachers (school_id);

-- Same lockdown: RLS on, no policies → only the server's service_role key.
alter table public.teachers enable row level security;
