-- 0005_schools.sql
-- Registry of primary schools, pre-populated from the public national list
-- (data.gov.hr "Osnovne škole", sourced from e-Matica, Open Licence). This lets
-- the admin create a principal's account already bound to the correct school.
--
-- The school a user belongs to is set SERVER-SIDE via users.school_id — never a
-- value the user picks that by itself grants access. All per-school data should
-- key off school_id. No OIB / no student data is stored here.

create table if not exists public.schools (
  id          uuid primary key default gen_random_uuid(),
  sifra       text unique not null,     -- e-Matica code, e.g. "17-125-001"
  naziv       text not null,
  mjesto      text,
  adresa      text,
  posta       text,
  zupanija    text,
  ravnatelj   text,                      -- public official; updatable
  email       text,
  web         text,
  telefon     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists schools_naziv_idx on public.schools (naziv);

-- Bind each principal to exactly one school (set by the admin at account time).
alter table public.users
  add column if not exists school_id uuid references public.schools(id);
create index if not exists users_school_idx on public.users (school_id);

-- Same lockdown as the other tables: RLS on, no policies → only the server's
-- service_role key can read/write.
alter table public.schools enable row level security;
