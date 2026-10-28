-- Godišnji odmor: persist ALL per-employee criteria so the principal enters
-- them once. go_socijalni holds sensitive HR data (djeca, invaliditet, samohrani,
-- Domovinski rat) — kept server-side only (RLS locked, service_role), scoped to
-- the school, and NEVER sent to the AI model. Stored on explicit request of the
-- school (data controller) for leave calculation.

alter table public.teachers
  add column if not exists go_socijalni jsonb not null default '{}'::jsonb,
  add column if not exists go_rezultati text;  -- izuzetni | vrlo_uspjesni | uspjesni | null

-- Reload PostgREST schema cache so the new columns are visible immediately:
--   NOTIFY pgrst, 'reload schema';
