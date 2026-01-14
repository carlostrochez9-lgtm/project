/*
  # Add Staff Position Levels

  1. Changes
    - Add `position_level` column to `profiles` table
      - Values: 'full_time', 'on_call_1', 'on_call_2'
      - Default: 'on_call_2' (lowest priority level)
      - NOT NULL constraint to ensure every staff member has a level
    
  2. Security
    - Update policies to allow admins to modify position levels
    - Staff can view their own position level but cannot modify it
*/

-- Add position_level column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'position_level'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN position_level text NOT NULL DEFAULT 'on_call_2' 
    CHECK (position_level IN ('full_time', 'on_call_1', 'on_call_2'));
  END IF;
END $$;

-- Create index for filtering by position level
CREATE INDEX IF NOT EXISTS idx_profiles_position_level ON profiles(position_level);

-- Update existing policies to include position_level in updates
-- Drop and recreate the admin update policy to include position_level
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
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
