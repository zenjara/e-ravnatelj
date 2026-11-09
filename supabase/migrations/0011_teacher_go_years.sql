-- 0011_teacher_go_years.sql
-- "Baza po godinama": one saved snapshot of a teacher's annual-leave (godišnji
-- odmor) criteria per calendar year. Lets the principal keep history (2025, 2026,
-- …) and preview/regenerate the Rješenje for any year on demand — the document is
-- deterministic from these criteria + header, so no PDF binary is stored.
--
-- go_socijalni holds sensitive HR data (djeca, invaliditet, samohrani, Domovinski
-- rat) — server-side only (RLS locked, service_role), scoped to the school, NEVER
-- sent to the AI. Stored on explicit request of the school (data controller).

create table if not exists public.teacher_go_years (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id)  on delete cascade,
  teacher_id   uuid not null references public.teachers(id) on delete cascade,
  godina       int  not null,
  kategorija   text,                                   -- I | II | III | ostali
  go_uvjeti    jsonb not null default '{}'::jsonb,
  go_socijalni jsonb not null default '{}'::jsonb,     -- sensitive (see above)
  go_rezultati text,                                   -- izuzetni | vrlo_uspjesni | uspjesni | null
  ukupno_dana  int,                                    -- computed total, stored for quick listing
  klasa        text,
  urbroj       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (teacher_id, godina)
);

create index if not exists teacher_go_years_school_idx on public.teacher_go_years (school_id);
create index if not exists teacher_go_years_teacher_idx on public.teacher_go_years (teacher_id);

-- Same lockdown as the rest: RLS on, no policies → only the server's service_role.
alter table public.teacher_go_years enable row level security;

-- Reload PostgREST schema cache so the new table is visible immediately:
--   NOTIFY pgrst, 'reload schema';
