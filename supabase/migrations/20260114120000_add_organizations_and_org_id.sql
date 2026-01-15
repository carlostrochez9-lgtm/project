-- Migration: add organizations table and org_id to key tables
-- Run this with your migration tooling (supabase migrate or psql)

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  org_id text unique not null,
  name text not null,
  logo_url text,
  primary_color text,
  billing_status text default 'trial',
  created_at timestamptz default now()
);

-- Add org_id column to existing tables if not present
alter table if exists employees add column if not exists org_id text;
alter table if exists events add column if not exists org_id text;
alter table if exists shifts add column if not exists org_id text;
alter table if exists beos add column if not exists org_id text;

-- Indexes for performance
-- Create indexes only if the target table exists to keep migration idempotent
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_employees_org_id ON employees(org_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_org_id ON events(org_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shifts') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_shifts_org_id ON shifts(org_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'beos') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_beos_org_id ON beos(org_id)';
  END IF;
END$$;

-- Note: You should add RLS policies to enforce org scoping for each table.
