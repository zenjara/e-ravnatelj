-- 0003_admin_law_management.sql
-- Admin role + law texts moved into the DB (so they're editable at runtime on
-- Vercel, whose filesystem is read-only) + a review queue for proposed changes.
-- Run in the Supabase SQL editor.

-- 1) Roles
alter table public.users add column if not exists role text not null default 'principal';

-- 2) Authoritative current law texts (source of truth; .txt files become a seed).
create table if not exists public.laws (
  slug          text primary key,
  title         text not null,
  kind          text not null default 'zakon',     -- 'zakon' | 'pravilnik'
  eli_base      text,                                -- NN ELI of the base act (for the monitor)
  current_text  text not null,
  version_label text,                                -- e.g. "68/18"
  applied_nn    text[] not null default '{}',        -- NN numbers applied, e.g. {'87/08','68/18'}
  updated_at    timestamptz not null default now()
);
alter table public.laws enable row level security;

-- 3) Proposed consolidations awaiting admin review.
create table if not exists public.law_proposals (
  id              bigint generated always as identity primary key,
  law_slug        text not null references public.laws(slug),
  nn_number       text not null,                     -- e.g. "151/22"
  nn_eli          text,
  amendment_title text,
  summary         text,                              -- human-readable summary
  diff            text,                              -- per-article before/after for display
  proposed_text   text not null,                     -- full new law text if approved
  status          text not null default 'pending',   -- pending | approved | rejected
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     text
);
alter table public.law_proposals enable row level security;
create index if not exists law_proposals_status_idx
  on public.law_proposals (status, created_at desc);
