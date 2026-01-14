/*
  # Add Reporting Views and Functions

  ## Overview
  Creates database views and functions to support reporting features and conflict checking.

  ## Changes
  
  ### 1. Schedule Conflict Checking Function
  - Creates `check_schedule_conflict` function
  - Checks if a staff member has an overlapping confirmed shift
  - Used to prevent double-booking staff members
  
  ### 2. Labor Report View
  - Creates `labor_report` view
  - Aggregates event data with labor costs and hours worked
  - Includes staff count and hourly rates for billing
  
  ### 3. Staff Reliability View
  - Creates `staff_reliability` view
  - Tracks on-time vs late arrivals for each staff member
  - Calculates reliability metrics based on check-in times
  
  ## Notes
  - The conflict check compares date and time ranges for overlaps
  - Labor calculations use check-in/out times to determine hours worked
  - Staff is considered "on time" if they check in before the event start time
*/

-- Function to check for schedule conflicts
CREATE OR REPLACE FUNCTION check_schedule_conflict(
  p_staff_id uuid,
  p_event_date date,
  p_start_time time,
  p_end_time time
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conflict_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM shift_requests sr
    JOIN events e ON sr.event_id = e.id
    WHERE sr.staff_id = p_staff_id
      AND sr.status = 'confirmed'
      AND e.event_date = p_event_date
      AND (
        (e.start_time, e.end_time) OVERLAPS (p_start_time, p_end_time)
      )
  ) INTO conflict_exists;
  
  RETURN conflict_exists;
END;
$$;

-- Create labor report view
CREATE OR REPLACE VIEW labor_report AS
SELECT 
  e.id AS event_id,
  e.title AS event_name,
  e.event_date,
  e.venue,
  e.hourly_rate,
  e.open_shifts AS positions_needed,
  COUNT(sr.id) AS total_staff,
  COALESCE(
    SUM(
      CASE 
        WHEN sr.check_in_time IS NOT NULL AND sr.check_out_time IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (sr.check_out_time - sr.check_in_time)) / 3600
        ELSE 0
      END
    ), 
    0
  ) AS total_hours_worked,
  COALESCE(
    SUM(
      CASE 
        WHEN sr.check_in_time IS NOT NULL AND sr.check_out_time IS NOT NULL AND e.hourly_rate IS NOT NULL
        THEN (EXTRACT(EPOCH FROM (sr.check_out_time - sr.check_in_time)) / 3600) * e.hourly_rate
        ELSE 0
      END
    ),
    0
  ) AS total_labor_cost
FROM events e
LEFT JOIN shift_requests sr ON e.id = sr.event_id AND sr.status = 'confirmed'
WHERE e.event_date < CURRENT_DATE
GROUP BY e.id, e.title, e.event_date, e.venue, e.hourly_rate, e.open_shifts;

-- Create staff reliability view
CREATE OR REPLACE VIEW staff_reliability AS
SELECT 
  p.id AS staff_id,
  p.full_name,
  p.email,
  p.staff_role,
  COUNT(sr.id) AS total_shifts,
  COUNT(
    CASE 
      WHEN sr.check_in_time IS NOT NULL 
        AND e.event_date IS NOT NULL 
        AND e.start_time IS NOT NULL
        AND sr.check_in_time::time <= e.start_time
      THEN 1 
    END
  ) AS on_time_count,
  COUNT(
    CASE 
      WHEN sr.check_in_time IS NOT NULL 
        AND e.event_date IS NOT NULL 
        AND e.start_time IS NOT NULL
        AND sr.check_in_time::time > e.start_time
      THEN 1 
    END
  ) AS late_count
FROM profiles p
JOIN shift_requests sr ON p.id = sr.staff_id
JOIN events e ON sr.event_id = e.id
WHERE sr.status = 'confirmed' 
  AND sr.check_in_time IS NOT NULL
  AND p.role = 'staff'
GROUP BY p.id, p.full_name, p.email, p.staff_role;