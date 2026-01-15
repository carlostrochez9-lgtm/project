-- Migration: add super-admin helper and update org policies to allow super-admin bypass
-- Adds a helper function `public.is_super_admin()` that checks the current JWT subject's role
-- and modifies org-level policies to allow super-admins to bypass org-scoping.

-- Create helper to check super-admin status
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id::text = current_setting('request.jwt.claims.sub', true)
      AND p.role = 'super_admin'
  );
$$;

-- Ensure pgcrypto exists if needed for gen_random_uuid() used elsewhere
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update events org policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'events_org_policy' AND polrelid = 'events'::regclass) THEN
    DROP POLICY IF EXISTS events_org_policy ON events;
  END IF;
  CREATE POLICY events_org_policy ON events
    FOR ALL
    USING (org_id::text = public.current_org_id() OR public.is_super_admin())
    WITH CHECK (org_id::text = public.current_org_id() OR public.is_super_admin());
END$$;

-- Update employees org policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'employees_org_policy' AND polrelid = 'employees'::regclass) THEN
      DROP POLICY IF EXISTS employees_org_policy ON employees;
    END IF;
    EXECUTE 'CREATE POLICY employees_org_policy ON employees FOR ALL USING (org_id::text = public.current_org_id() OR public.is_super_admin()) WITH CHECK (org_id::text = public.current_org_id() OR public.is_super_admin())';
  END IF;
END$$;

-- Update shifts org policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shifts') THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'shifts_org_policy' AND polrelid = 'shifts'::regclass) THEN
      DROP POLICY IF EXISTS shifts_org_policy ON shifts;
    END IF;
    EXECUTE 'CREATE POLICY shifts_org_policy ON shifts FOR ALL USING (org_id::text = public.current_org_id() OR public.is_super_admin()) WITH CHECK (org_id::text = public.current_org_id() OR public.is_super_admin())';
  END IF;
END$$;

-- Update beos org policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'beos') THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'beos_org_policy' AND polrelid = 'beos'::regclass) THEN
      DROP POLICY IF EXISTS beos_org_policy ON beos;
    END IF;
    EXECUTE 'CREATE POLICY beos_org_policy ON beos FOR ALL USING (org_id::text = public.current_org_id() OR public.is_super_admin()) WITH CHECK (org_id::text = public.current_org_id() OR public.is_super_admin())';
  END IF;
END$$;

-- Allow super-admin to read any profile (drop & recreate a permissive select policy)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'profiles_self' AND polrelid = 'profiles'::regclass) THEN
    DROP POLICY IF EXISTS profiles_self ON profiles;
  END IF;
  CREATE POLICY profiles_self ON profiles
    FOR SELECT
    USING (id::text = current_setting('request.jwt.claims.sub', true) OR public.is_super_admin());
END$$;

-- Note: This migration updates policies to allow checks for `public.is_super_admin()`.
-- To create a master login you still need a corresponding auth user (auth.users) and a
-- `profiles` row with `role = 'super_admin'`. Use `scripts/create_admin.js --role super_admin`
-- or create the auth user via Supabase admin API and then upsert a profile with role 'super_admin'.
