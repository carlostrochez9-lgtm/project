/*
  # Remove Duplicate Index

  ## Overview
  Removes duplicate index on events table to eliminate redundancy.
  
  ## Changes
  
  ### Remove Duplicate Index
  - Drop `idx_events_event_date` as it duplicates existing `idx_events_date`
  - Keep the original `idx_events_date` index
  
  ## Notes
  - The "unused index" warnings for recently created indexes are expected
  - Indexes will be utilized as queries run over time
  - Foreign key indexes improve JOIN performance even if not immediately used
*/

-- Drop the duplicate index (keeping the original idx_events_date)
DROP INDEX IF EXISTS idx_events_event_date;