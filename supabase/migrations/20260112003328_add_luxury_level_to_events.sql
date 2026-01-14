/*
  # Add Luxury Level Field

  ## Overview
  Adds luxury level classification to events for premium categorization.

  ## Changes
  
  ### Modify Events Table
  - Add `luxury_level` field with options: Standard, Premium, Ultra Luxury
  - Defaults to 'Premium' for high-end positioning
  
  ## Notes
  - This field helps staff understand the prestige level of each engagement
  - Can be used for future filtering and reporting features
*/

-- Add luxury level field to events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'luxury_level'
  ) THEN
    ALTER TABLE events ADD COLUMN luxury_level text DEFAULT 'Premium' CHECK (luxury_level IN ('Standard', 'Premium', 'Ultra Luxury'));
  END IF;
END $$;