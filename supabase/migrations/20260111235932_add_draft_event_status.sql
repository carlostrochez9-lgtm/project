/*
  # Add Draft Event Status Support

  ## Overview
  Adds support for draft events that can be reviewed before being published to staff.

  ## Changes
  
  ### 1. Add Status Column to Events Table
  - Adds `status` column with values: 'draft' or 'published'
  - Defaults to 'published' for backward compatibility
  
  ### 2. Add BEO Source Column
  - Adds `beo_source` column to track if event was created from BEO upload
  - Stores the original filename for reference
  
  ### 3. Update RLS Policies
  - Staff can only see published events
  - Admins can see all events (draft and published)
  
  ## Notes
  - Existing events will automatically be 'published'
  - Draft events are only visible to admins
*/

-- =====================================================
-- Add Status and BEO Source Columns
-- =====================================================

-- Add status column (draft or published)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'status'
  ) THEN
    ALTER TABLE events ADD COLUMN status text DEFAULT 'published' CHECK (status IN ('draft', 'published'));
  END IF;
END $$;

-- Add beo_source column to track AI-extracted events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'beo_source'
  ) THEN
    ALTER TABLE events ADD COLUMN beo_source text;
  END IF;
END $$;

-- =====================================================
-- Update RLS Policies for Draft Events
-- =====================================================

-- Drop existing SELECT policy for events
DROP POLICY IF EXISTS "Staff can view published events" ON events;
DROP POLICY IF EXISTS "Staff can view events" ON events;
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;

-- Create new SELECT policy that shows published events to staff, all events to admins
CREATE POLICY "Users can view events based on role and status"
  ON events FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all events (draft and published)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
    OR
    -- Staff can only see published events
    (
      status = 'published'
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = (select auth.uid())
      )
    )
  );

-- Ensure admins can create events (including drafts)
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

-- Ensure admins can update events (including publishing drafts)
DROP POLICY IF EXISTS "Admins can update events" ON events;
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

-- Ensure admins can delete events
DROP POLICY IF EXISTS "Admins can delete events" ON events;
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

-- =====================================================
-- Update Views to Consider Event Status
-- =====================================================

-- Recreate available_events_with_capacity to only show published events
DROP VIEW IF EXISTS available_events_with_capacity CASCADE;
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
FROM events e
WHERE e.status = 'published';  -- Only show published events

GRANT SELECT ON available_events_with_capacity TO authenticated;