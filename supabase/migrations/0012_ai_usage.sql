-- 0012_ai_usage.sql
-- Per-user daily counter for AI (/api/ask) calls, used as a hard spend cap so a
-- single account looping requests can't run up the Gemini bill. One row per
-- (user, calendar day); the counter resets naturally the next day because the
-- date is part of the key and we only ever read/write today's row.
--
-- Service-role-only (RLS on, no policies). No PII — just a count per user/day.
create table if not exists public.ai_usage (
  user_id    uuid not null references public.users(id) on delete cascade,
  dan        date not null default current_date,
  broj       int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, dan)
);

alter table public.ai_usage enable row level security;

-- Atomic "increment today's count and tell me if it's still within the limit".
-- Returns TRUE when the call is allowed (count after increment <= p_limit),
-- FALSE when the cap is reached. The stored value is clamped to p_limit+1 so a
-- user who keeps hammering after the cap doesn't grow the counter unbounded.
create or replace function public.bump_ai_usage(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.ai_usage (user_id, dan, broj)
  values (p_user_id, current_date, 1)
  on conflict (user_id, dan) do update
    set broj = least(public.ai_usage.broj + 1, p_limit + 1),
        updated_at = now()
  returning broj into v_count;
  return v_count <= p_limit;
end;
$$;

grant execute on function public.bump_ai_usage(uuid, int) to service_role;

-- Reload PostgREST schema cache so the new table + function are visible:
--   NOTIFY pgrst, 'reload schema';
