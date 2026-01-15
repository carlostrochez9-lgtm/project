-- Local auth schema and helpers for running migrations in local Postgres
-- This creates minimal objects expected by migrations (auth.users, auth.uid())
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    PERFORM pg_catalog.set_config('search_path', 'public', false); -- noop
    EXECUTE 'CREATE SCHEMA auth';
  END IF;
END$$;

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- auth.uid() stub: returns NULL for unauthenticated local runs
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
BEGIN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Ensure roles used in migrations exist locally
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END$$;

-- Grant minimal permissions for local testing
GRANT USAGE ON SCHEMA auth TO PUBLIC;
