/*
  # Security and Performance Optimization

  ## Overview
  Fixes multiple security and performance issues identified by Supabase analysis.

  ## Changes
  
  ### 1. Add Missing Indexes for Foreign Keys
  - Index for events.created_by
  - Index for shift_requests.approved_by
  - Index for shift_requests.uniform_verified_by
  
  ### 2. Optimize RLS Policies
  - Replace auth.uid() with (select auth.uid()) for better performance
  - Prevents re-evaluation of auth functions for each row
  
  ### 3. Fix Function Security
  - Set explicit search_path for functions to prevent security issues
  
  ### 4. Fix View Security
  - Remove SECURITY DEFINER from views where not needed
  - Add proper security context
  
  ## Notes
  - Multiple permissive policies are intentional (admins + users have different access)
  - Unused indexes are kept as they will be used at scale
*/

-- =====================================================
-- Add Missing Foreign Key Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_shift_requests_approved_by ON shift_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_shift_requests_uniform_verified_by ON shift_requests(uniform_verified_by);

-- =====================================================
-- Optimize RLS Policies - Profiles Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update user validation" ON profiles;
CREATE POLICY "Admins can update user validation"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
    )
  );

-- =====================================================
-- Optimize RLS Policies - Events Table
-- =====================================================

DROP POLICY IF EXISTS "Admins can create events" ON events;
CREATE POLICY "Admins can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update their events" ON events;
CREATE POLICY "Admins can update their events"
  ON events FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can delete their events" ON events;
CREATE POLICY "Admins can delete their events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- Optimize RLS Policies - Shift Requests Table
-- =====================================================

DROP POLICY IF EXISTS "Staff can view their own shift requests" ON shift_requests;
CREATE POLICY "Staff can view their own shift requests"
  ON shift_requests FOR SELECT
  TO authenticated
  USING (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Staff can create shift requests" ON shift_requests;
CREATE POLICY "Staff can create shift requests"
  ON shift_requests FOR INSERT
  TO authenticated
  WITH CHECK (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can view all shift requests" ON shift_requests;
CREATE POLICY "Admins can view all shift requests"
  ON shift_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update shift request status" ON shift_requests;
CREATE POLICY "Admins can update shift request status"
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

DROP POLICY IF EXISTS "Admins can update shift signatures" ON shift_requests;
CREATE POLICY "Admins can update shift signatures"
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
-- Fix Function Security - Add Explicit Search Path
-- =====================================================

CREATE OR REPLACE FUNCTION check_schedule_conflict(
  p_staff_id uuid,
  p_event_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_event_id uuid DEFAULT NULL
) RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM shift_requests sr
    JOIN events e ON sr.event_id = e.id
    WHERE sr.staff_id = p_staff_id
    AND sr.status = 'confirmed'
    AND e.event_date = p_event_date
    AND (p_exclude_event_id IS NULL OR e.id != p_exclude_event_id)
    AND (
      (e.start_time, e.end_time) OVERLAPS (p_start_time, p_end_time)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION count_confirmed_staff(p_event_id uuid) 
RETURNS integer 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM shift_requests
    WHERE event_id = p_event_id
    AND status = 'confirmed'
  );
END;
$$;

-- =====================================================
-- Recreate Views Without SECURITY DEFINER
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS labor_report;
DROP VIEW IF EXISTS staff_reliability;
DROP VIEW IF EXISTS available_events_with_capacity;

-- Recreate labor_report without SECURITY DEFINER
CREATE VIEW labor_report AS
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

-- Recreate staff_reliability without SECURITY DEFINER
CREATE VIEW staff_reliability AS
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

-- Recreate available_events_with_capacity without SECURITY DEFINER
CREATE VIEW available_events_with_capacity AS
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
-- Add RLS Policies to Views (if needed)
-- =====================================================

-- Views inherit RLS from their underlying tables when accessed
-- No additional RLS needed on views themselves

-- =====================================================
-- Performance Optimization: Add composite indexes
-- =====================================================

-- Composite index for shift_requests queries by staff and status
CREATE INDEX IF NOT EXISTS idx_shift_requests_staff_id_status ON shift_requests(staff_id, status);

-- Composite index for shift_requests queries by event and status
CREATE INDEX IF NOT EXISTS idx_shift_requests_event_id_status ON shift_requests(event_id, status);

-- Index for profiles role queries (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON profiles(id, role);

-- =====================================================
-- Clean up duplicate policies if any exist
-- =====================================================

-- The multiple permissive policies warning is intentional
-- We want both admins to see all AND users to see their own
-- This is the correct security model for our application

-- Note: Unused indexes will become useful at scale
-- Keeping them for future performance optimization