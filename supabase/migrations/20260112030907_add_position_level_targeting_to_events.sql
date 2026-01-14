/*
  # Add Position Level Targeting to Events

  1. Changes
    - Add `target_position_levels` column to `events` table
      - Array of text values to store multiple position levels
      - Can be: ['full_time'], ['on_call_1'], ['on_call_2'], or any combination
      - NULL means target all staff (backward compatibility)
    
    - Add helper function to check if staff member matches event targeting

  2. Security
    - Update policies to use position level filtering
    - Staff can only see events that target their position level (or events with no targeting)
*/

-- Add target_position_levels column to events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'target_position_levels'
  ) THEN
    ALTER TABLE events 
    ADD COLUMN target_position_levels text[];
  END IF;
END $$;

-- Create index for filtering by position levels
CREATE INDEX IF NOT EXISTS idx_events_target_position_levels ON events USING GIN(target_position_levels);

-- Create function to check if staff member should see event
CREATE OR REPLACE FUNCTION can_staff_view_event(
  event_target_levels text[],
  staff_position_level text
)
RETURNS boolean AS $$
BEGIN
  -- If no targeting is set, everyone can see it
  IF event_target_levels IS NULL OR array_length(event_target_levels, 1) IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if staff position level is in the target array
  RETURN staff_position_level = ANY(event_target_levels);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update staff view policy to include position level filtering
DROP POLICY IF EXISTS "Staff can view published events" ON events;

CREATE POLICY "Staff can view published events"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'staff'
      AND can_staff_view_event(events.target_position_levels, profiles.position_level)
    )
  );
