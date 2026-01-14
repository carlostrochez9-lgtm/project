/*
  # Advanced Staffing Management Features

  ## Overview
  Adds user validation, digital signing, and time tracking for comprehensive staff management.

  ## Changes to Existing Tables
  
  ### profiles table
  - Add `is_validated` (boolean, default false) - Admin approval status
  
  ### shift_requests table
  - Add `check_in_signature` (text) - Digital signature data for check-in
  - Add `check_in_time` (timestamptz) - When staff checked in
  - Add `check_out_signature` (text) - Digital signature data for check-out
  - Add `check_out_time` (timestamptz) - When staff checked out
  - Add `uniform_verified` (boolean, default false) - Manager verification of uniform
  - Add `uniform_verified_by` (uuid, references profiles) - Manager who verified
  - Add `uniform_verified_at` (timestamptz) - When uniform was verified
  
  ## New Functionality
  - User validation workflow prevents unvalidated users from accessing dashboard
  - Digital signature capture for check-in/check-out
  - Automatic time tracking for labor reports
  - Uniform verification by managers
  
  ## Notes
  - All new fields have appropriate defaults
  - Time tracking enables accurate labor cost reporting
  - Signature data stored as base64 strings
*/

-- Add validation field to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_validated'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_validated boolean DEFAULT false;
  END IF;
END $$;

-- Add signing and verification fields to shift_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_requests' AND column_name = 'check_in_signature'
  ) THEN
    ALTER TABLE shift_requests ADD COLUMN check_in_signature text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_requests' AND column_name = 'check_in_time'
  ) THEN
    ALTER TABLE shift_requests ADD COLUMN check_in_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_requests' AND column_name = 'check_out_signature'
  ) THEN
    ALTER TABLE shift_requests ADD COLUMN check_out_signature text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_requests' AND column_name = 'check_out_time'
  ) THEN
    ALTER TABLE shift_requests ADD COLUMN check_out_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_requests' AND column_name = 'uniform_verified'
  ) THEN
    ALTER TABLE shift_requests ADD COLUMN uniform_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_requests' AND column_name = 'uniform_verified_by'
  ) THEN
    ALTER TABLE shift_requests ADD COLUMN uniform_verified_by uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_requests' AND column_name = 'uniform_verified_at'
  ) THEN
    ALTER TABLE shift_requests ADD COLUMN uniform_verified_at timestamptz;
  END IF;
END $$;

-- Drop existing policies if they exist and recreate them
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
  DROP POLICY IF EXISTS "Admins can update user validation" ON profiles;
  DROP POLICY IF EXISTS "Admins can update shift signatures" ON shift_requests;
END $$;

-- Add policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Add policy for admins to update user validation
CREATE POLICY "Admins can update user validation"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Add policy for admins to update shift_requests for signing
CREATE POLICY "Admins can update shift signatures"
  ON shift_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create view for labor reports
CREATE OR REPLACE VIEW labor_report AS
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

-- Create view for staff reliability
CREATE OR REPLACE VIEW staff_reliability AS
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

-- Grant access to views
GRANT SELECT ON labor_report TO authenticated;
GRANT SELECT ON staff_reliability TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shift_requests_check_in ON shift_requests(check_in_time);
CREATE INDEX IF NOT EXISTS idx_shift_requests_check_out ON shift_requests(check_out_time);
CREATE INDEX IF NOT EXISTS idx_profiles_validated ON profiles(is_validated);