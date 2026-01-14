/*
  # Fix Security Issues

  ## Overview
  Addresses security and performance issues identified in database audit:
  - Adds missing indexes for foreign key columns
  - Removes duplicate permissive RLS policies
  
  ## Changes
  
  ### 1. Add Indexes for Foreign Keys
  - Add index on `events.created_by` for better query performance
  - Add index on `shift_requests.approved_by` for better query performance
  - Add index on `shift_requests.uniform_verified_by` for better query performance
  
  ### 2. Clean Up Duplicate RLS Policies
  - Remove old/duplicate policies on events table
  - Keep only the most current and secure policies
  
  ## Performance Impact
  - Indexes will improve JOIN and WHERE clause performance
  - Cleaner policy structure improves policy evaluation speed
  
  ## Security Impact
  - Eliminates ambiguity from multiple permissive policies
  - Ensures single source of truth for access control
*/

-- =====================================================
-- Add Missing Indexes for Foreign Keys
-- =====================================================

-- Index for events.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_events_created_by 
  ON events(created_by);

-- Index for shift_requests.approved_by foreign key
CREATE INDEX IF NOT EXISTS idx_shift_requests_approved_by 
  ON shift_requests(approved_by);

-- Index for shift_requests.uniform_verified_by foreign key
CREATE INDEX IF NOT EXISTS idx_shift_requests_uniform_verified_by 
  ON shift_requests(uniform_verified_by);

-- Additional useful indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_status 
  ON events(status);

CREATE INDEX IF NOT EXISTS idx_events_event_date 
  ON events(event_date);

CREATE INDEX IF NOT EXISTS idx_shift_requests_status 
  ON shift_requests(status);

CREATE INDEX IF NOT EXISTS idx_shift_requests_event_id 
  ON shift_requests(event_id);

-- =====================================================
-- Clean Up Duplicate RLS Policies on Events Table
-- =====================================================

-- Drop all existing policies on events table
DROP POLICY IF EXISTS "Authenticated users can view all events" ON events;
DROP POLICY IF EXISTS "Admins can delete their events" ON events;
DROP POLICY IF EXISTS "Admins can update their events" ON events;

-- The following policies should remain (they're the correct ones):
-- "Users can view events based on role and status" (SELECT)
-- "Admins can create events" (INSERT)
-- "Admins can update events" (UPDATE)
-- "Admins can delete events" (DELETE)

-- Verify and recreate if needed
DO $$
BEGIN
  -- Ensure the correct SELECT policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'events' 
    AND policyname = 'Users can view events based on role and status'
  ) THEN
    CREATE POLICY "Users can view events based on role and status"
      ON events FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (select auth.uid())
          AND profiles.role = 'admin'
        )
        OR
        (
          status = 'published'
          AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (select auth.uid())
          )
        )
      );
  END IF;

  -- Ensure the correct INSERT policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'events' 
    AND policyname = 'Admins can create events'
  ) THEN
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
  END IF;

  -- Ensure the correct UPDATE policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'events' 
    AND policyname = 'Admins can update events'
  ) THEN
    CREATE POLICY "Admins can update events"
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
  END IF;

  -- Ensure the correct DELETE policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'events' 
    AND policyname = 'Admins can delete events'
  ) THEN
    CREATE POLICY "Admins can delete events"
      ON events FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (select auth.uid())
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;