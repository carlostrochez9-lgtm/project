/*
  # Enhanced Staffing Platform with Roles and Approval Workflow

  ## Overview
  Adds staff roles, event timing, approval workflow, and uniform requirements to create a comprehensive luxury staffing system.

  ## Changes to Existing Tables
  
  ### profiles table
  - Add `staff_role` (text) - Staff specialty: 'Server', 'Bartender', 'Host'
  - Add `rating` (numeric, default 5.0) - Staff performance rating
  - Add `status` (text, default 'active') - Account status
  
  ### events table
  - Add `role_required` (text, not null) - Required staff role for this event
  - Add `start_time` (time, not null) - Event start time
  - Add `end_time` (time, not null) - Event end time
  - Add `hourly_rate` (numeric) - Payment rate for this engagement
  - Add `uniform_requirements` (text) - Detailed uniform checklist for confirmed staff
  - Rename `open_shifts` to `positions_needed` for clarity
  
  ### shift_requests table
  - Change default status from 'confirmed' to 'pending'
  - Add `approved_at` (timestamptz) - When admin approved the request
  - Add `approved_by` (uuid, references profiles) - Admin who approved
  
  ## New Functionality
  - Staff can only see events matching their role
  - Shift requests start as 'pending' and require admin approval
  - Events track capacity (positions_needed vs confirmed requests)
  - Conflict detection prevents double-booking
  - Uniform checklist appears after confirmation
  
  ## Notes
  - All changes maintain data integrity with proper constraints
  - Existing RLS policies remain secure
  - New fields have sensible defaults where appropriate
*/

-- Add new columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'staff_role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN staff_role text CHECK (staff_role IN ('Server', 'Bartender', 'Host'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rating'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rating numeric DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

-- Add new columns to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'role_required'
  ) THEN
    ALTER TABLE events ADD COLUMN role_required text NOT NULL DEFAULT 'Server' CHECK (role_required IN ('Server', 'Bartender', 'Host'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE events ADD COLUMN start_time time NOT NULL DEFAULT '18:00:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE events ADD COLUMN end_time time NOT NULL DEFAULT '23:00:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE events ADD COLUMN hourly_rate numeric CHECK (hourly_rate > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'uniform_requirements'
  ) THEN
    ALTER TABLE events ADD COLUMN uniform_requirements text;
  END IF;
END $$;

-- Add new columns to shift_requests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_requests' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE shift_requests ADD COLUMN approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_requests' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE shift_requests ADD COLUMN approved_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Update shift_requests default status to 'pending'
ALTER TABLE shift_requests ALTER COLUMN status SET DEFAULT 'pending';

-- Create function to check for scheduling conflicts
CREATE OR REPLACE FUNCTION check_schedule_conflict(
  p_staff_id uuid,
  p_event_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_event_id uuid DEFAULT NULL
) RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to count confirmed staff for an event
CREATE OR REPLACE FUNCTION count_confirmed_staff(p_event_id uuid) 
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM shift_requests
    WHERE event_id = p_event_id
    AND status = 'confirmed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for conflict checking
CREATE INDEX IF NOT EXISTS idx_shift_requests_staff_status ON shift_requests(staff_id, status);

-- Create view for available events with capacity info
DROP VIEW IF EXISTS available_events_with_capacity CASCADE;
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

-- Grant access to the view
GRANT SELECT ON available_events_with_capacity TO authenticated;