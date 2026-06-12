-- 0001_users.sql
-- Data model for e-ravnatelj: principals (ravnatelji) with bcrypt-hashed passwords.
-- Run this in the Supabase SQL editor (or via the Supabase CLI) before seeding.
--
-- PII is kept minimal: no OIB, no personal name — only a login username and the
-- school name. See PROJECT brief: "Keep PII minimal. Do not store OIB."

create extension if not exists pgcrypto; -- provides gen_random_uuid()

create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,           -- bcrypt hash; never store plaintext
  school_name   text,
  created_at    timestamptz not null default now()
);

-- Lock the table down. Enabling RLS with NO policies denies all access to the
-- anon/authenticated API roles, so password hashes can never be read from the
-- browser. The server uses the service_role key, which bypasses RLS entirely.
alter table public.users enable row level security;
