-- Godišnji odmor: extend the staff roster with the non-sensitive data needed
-- to compute annual leave. NO sensitive personal data here — social criteria
-- (children, disability, …) are entered at generation time and never stored.

alter table public.teachers
  add column if not exists staz_ukupno    integer,  -- raw e-Matica "Radno iskustvo (ukupno)"
  add column if not exists staz_obrazovni integer,  -- raw e-Matica "Radno iskustvo (obrazovno)"
  add column if not exists kategorija     text,     -- složenost posla: I / II / III / ostali (uredivo)
  add column if not exists go_uvjeti      jsonb not null default '{}'::jsonb; -- uvjeti rada (razrednik, smjenski, …)

-- PostgREST caches the schema; reload so the new columns are visible immediately:
--   NOTIFY pgrst, 'reload schema';
