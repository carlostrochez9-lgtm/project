-- Enable Row Level Security and add example policies to enforce org scoping
-- Run as a superuser / via migration tooling

-- Enable RLS on tables
ALTER TABLE IF EXISTS events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS beos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- Example policy: allow select/insert/update/delete for rows where org_id matches
-- This assumes JWT tokens include a claim `org_id` or you use `current_setting('request.jwt.claims.org_id')`

-- Function to read org_id from JWT claims (Supabase style)
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS text SECURITY DEFINER
LANGUAGE sql AS $$
  SELECT COALESCE(current_setting('request.jwt.claims.org_id', true), '')::text;
$$;

-- Policies for events
DROP POLICY IF EXISTS events_org_policy ON events;
CREATE POLICY events_org_policy ON events
  FOR ALL
  USING (org_id::text = public.current_org_id())
  WITH CHECK (org_id::text = public.current_org_id());

-- Policies for employees
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
    DROP POLICY IF EXISTS employees_org_policy ON employees;
    EXECUTE 'CREATE POLICY employees_org_policy ON employees FOR ALL USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id())';
  END IF;
END$$;

-- Policies for shifts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shifts') THEN
    DROP POLICY IF EXISTS shifts_org_policy ON shifts;
    EXECUTE 'CREATE POLICY shifts_org_policy ON shifts FOR ALL USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id())';
  END IF;
END$$;

-- Policies for beos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'beos') THEN
    DROP POLICY IF EXISTS beos_org_policy ON beos;
    EXECUTE 'CREATE POLICY beos_org_policy ON beos FOR ALL USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id())';
  END IF;
END$$;

-- Policy for profiles: allow users to see their own profile; admins require separate policies
DROP POLICY IF EXISTS profiles_self ON profiles;
CREATE POLICY profiles_self ON profiles
  FOR SELECT USING (id::text = current_setting('request.jwt.claims.sub', true)) ;

-- Note: Super admin handling and finer-grained role checks should be implemented
-- using additional JWT claims (e.g. role) or by testing for a role column in profiles.
