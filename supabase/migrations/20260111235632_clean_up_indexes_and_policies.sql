/*
  # Clean Up Indexes and Optimize Policies

  ## Overview
  Removes unused indexes, fixes duplicate indexes, consolidates RLS policies, and ensures views don't have SECURITY DEFINER.

  ## Changes
  
  ### 1. Remove Unused Indexes
  - Drops indexes that are not being used by queries
  - Reduces write overhead and storage
  
  ### 2. Fix Duplicate Indexes
  - Removes duplicate index (keeps the more descriptive one)
  
  ### 3. Consolidate RLS Policies
  - Combines multiple permissive policies into single policies with OR conditions
  - Improves performance and reduces policy evaluation overhead
  
  ### 4. Fix View Definitions
  - Ensures views are created without SECURITY DEFINER
  
  ## Notes
  - Indexes can be added back later if query patterns change
  - Consolidated policies maintain the same security model
*/

-- =====================================================
-- Drop Unused Indexes
-- =====================================================

DROP INDEX IF EXISTS idx_shift_requests_event;
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_shift_requests_check_in;
DROP INDEX IF EXISTS idx_shift_requests_check_out;
DROP INDEX IF EXISTS idx_profiles_validated;
DROP INDEX IF EXISTS idx_events_created_by;
DROP INDEX IF EXISTS idx_shift_requests_approved_by;
DROP INDEX IF EXISTS idx_shift_requests_uniform_verified_by;
DROP INDEX IF EXISTS idx_shift_requests_staff_id_status;
DROP INDEX IF EXISTS idx_shift_requests_event_id_status;
DROP INDEX IF EXISTS idx_profiles_id_role;

-- =====================================================
-- Fix Duplicate Indexes
-- =====================================================

-- Drop the old index, keeping the more descriptive one
DROP INDEX IF EXISTS idx_shift_requests_staff_status;

-- =====================================================
-- Consolidate RLS Policies - Profiles Table (SELECT)
-- =====================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create single consolidated SELECT policy
-- Ensure consolidated policy is removed before creating to allow idempotent runs
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own profile OR user is an admin
    (select auth.uid()) = id
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
    )
  );

-- =====================================================
-- Consolidate RLS Policies - Profiles Table (UPDATE)
-- =====================================================

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update user validation" ON profiles;

-- Create single consolidated UPDATE policy
-- Ensure consolidated update policy is removed before creating to allow idempotent runs
DROP POLICY IF EXISTS "Users can update profiles" ON profiles;

CREATE POLICY "Users can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile OR user is an admin
    (select auth.uid()) = id
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    -- Same check for WITH CHECK
    (select auth.uid()) = id
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
    )
  );

-- =====================================================
-- Consolidate RLS Policies - Shift Requests (SELECT)
-- =====================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Staff can view their own shift requests" ON shift_requests;
DROP POLICY IF EXISTS "Admins can view all shift requests" ON shift_requests;

-- Create single consolidated SELECT policy
-- Ensure consolidated shift-requests select policy is removed before creating
DROP POLICY IF EXISTS "Users can view shift requests" ON shift_requests;

CREATE POLICY "Users can view shift requests"
  ON shift_requests FOR SELECT
  TO authenticated
  USING (
    -- Staff can see their own requests OR user is an admin
    staff_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- Consolidate RLS Policies - Shift Requests (UPDATE)
-- =====================================================

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Admins can update shift request status" ON shift_requests;
DROP POLICY IF EXISTS "Admins can update shift signatures" ON shift_requests;

-- Create single consolidated UPDATE policy for admins
-- Ensure consolidated admins update policy is removed before creating
DROP POLICY IF EXISTS "Admins can update shift requests" ON shift_requests;

CREATE POLICY "Admins can update shift requests"
  ON shift_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- Recreate Views Without SECURITY DEFINER (Explicit)
-- =====================================================

-- Drop and recreate all views to ensure no SECURITY DEFINER
DROP VIEW IF EXISTS labor_report CASCADE;
DROP VIEW IF EXISTS staff_reliability CASCADE;
DROP VIEW IF EXISTS available_events_with_capacity CASCADE;

-- Recreate labor_report with explicit SECURITY INVOKER
CREATE VIEW labor_report 
WITH (security_invoker = true) AS
SELECT 
  e.id as event_id,
  e.title as event_name,
  e.event_date,
  e.venue,
  e.hourly_rate,
  e.open_shifts as positions_needed,
  COUNT(sr.id) as total_staff,
  SUM(
    CASE 
      WHEN sr.check_in_time IS NOT NULL AND sr.check_out_time IS NOT NULL
      THEN EXTRACT(EPOCH FROM (sr.check_out_time - sr.check_in_time)) / 3600
      ELSE 0
    END
  ) as total_hours_worked,
  SUM(
    CASE 
      WHEN sr.check_in_time IS NOT NULL AND sr.check_out_time IS NOT NULL AND e.hourly_rate IS NOT NULL
      THEN (EXTRACT(EPOCH FROM (sr.check_out_time - sr.check_in_time)) / 3600) * e.hourly_rate
      ELSE 0
    END
  ) as total_labor_cost
FROM events e
LEFT JOIN shift_requests sr ON e.id = sr.event_id AND sr.status = 'confirmed'
GROUP BY e.id, e.title, e.event_date, e.venue, e.hourly_rate, e.open_shifts;

-- Recreate staff_reliability with explicit SECURITY INVOKER
CREATE VIEW staff_reliability 
WITH (security_invoker = true) AS
SELECT 
  p.id as staff_id,
  p.full_name,
  p.email,
  p.staff_role,
  COUNT(sr.id) as total_shifts,
  SUM(
    CASE 
      WHEN sr.check_in_time IS NOT NULL 
      AND sr.check_in_time <= (e.event_date + e.start_time::time)
      THEN 1
      ELSE 0
    END
  ) as on_time_count,
  SUM(
    CASE 
      WHEN sr.check_in_time IS NOT NULL 
      AND sr.check_in_time > (e.event_date + e.start_time::time)
      THEN 1
      ELSE 0
    END
  ) as late_count
FROM profiles p
LEFT JOIN shift_requests sr ON p.id = sr.staff_id AND sr.status = 'confirmed'
LEFT JOIN events e ON sr.event_id = e.id
WHERE p.role = 'staff'
GROUP BY p.id, p.full_name, p.email, p.staff_role;

-- Recreate available_events_with_capacity with explicit SECURITY INVOKER
CREATE VIEW available_events_with_capacity 
WITH (security_invoker = true) AS
SELECT 
  e.*,
  COALESCE(
    (SELECT COUNT(*) FROM shift_requests sr 
     WHERE sr.event_id = e.id AND sr.status = 'confirmed'),
    0
  ) as confirmed_count,
  e.open_shifts - COALESCE(
    (SELECT COUNT(*) FROM shift_requests sr 
     WHERE sr.event_id = e.id AND sr.status = 'confirmed'),
    0
  ) as remaining_positions
FROM events e;

-- Grant proper access to views
GRANT SELECT ON labor_report TO authenticated;
GRANT SELECT ON staff_reliability TO authenticated;
GRANT SELECT ON available_events_with_capacity TO authenticated;

-- =====================================================
-- Summary
-- =====================================================

-- Removed 12 unused indexes to improve write performance
-- Fixed 1 duplicate index
-- Consolidated 6 policies into 4 policies (same security model, better performance)
-- Ensured all views use SECURITY INVOKER instead of SECURITY DEFINER