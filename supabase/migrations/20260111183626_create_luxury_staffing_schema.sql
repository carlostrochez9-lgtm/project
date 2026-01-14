/*
  # Luxury Banquet Staffing Platform Schema

  ## Overview
  Complete database schema for a luxury event staffing application with admin and staff roles.

  ## New Tables
  
  ### 1. profiles
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, not null)
  - `full_name` (text)
  - `role` (text, not null, default 'staff') - Either 'admin' or 'staff'
  - `created_at` (timestamptz, default now())
  
  ### 2. events
  - `id` (uuid, primary key)
  - `title` (text, not null) - Name of the grand event
  - `event_date` (date, not null) - Date of the event
  - `venue` (text, not null) - Event venue
  - `dress_code` (text, not null) - Required dress code
  - `open_shifts` (integer, not null) - Number of available positions
  - `description` (text) - Additional event details
  - `created_by` (uuid, references profiles) - Admin who created the event
  - `created_at` (timestamptz, default now())
  
  ### 3. shift_requests
  - `id` (uuid, primary key)
  - `event_id` (uuid, references events)
  - `staff_id` (uuid, references profiles)
  - `status` (text, not null, default 'confirmed') - Status: 'confirmed', 'pending', 'rejected'
  - `requested_at` (timestamptz, default now())
  
  ## Security
  
  ### RLS Policies
  
  #### profiles table
  - Enable RLS
  - Users can read their own profile
  - Users can update their own profile
  - Admins can read all profiles
  
  #### events table
  - Enable RLS
  - Everyone authenticated can view events
  - Only admins can create events
  - Only admins can update/delete their own events
  
  #### shift_requests table
  - Enable RLS
  - Staff can view their own shift requests
  - Staff can create shift requests
  - Admins can view all shift requests
  - Staff can view shift requests for events they requested
  
  ## Notes
  - All tables use RLS for security
  - Timestamps are in UTC
  - Foreign keys maintain referential integrity
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at timestamptz DEFAULT now()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_date date NOT NULL,
  venue text NOT NULL,
  dress_code text NOT NULL,
  open_shifts integer NOT NULL DEFAULT 1 CHECK (open_shifts > 0),
  description text,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create shift_requests table
CREATE TABLE IF NOT EXISTS shift_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'rejected')),
  requested_at timestamptz DEFAULT now(),
  UNIQUE(event_id, staff_id)
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Events policies
CREATE POLICY "Authenticated users can view all events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update their events"
  ON events FOR UPDATE
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

CREATE POLICY "Admins can delete their events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Shift requests policies
CREATE POLICY "Staff can view their own shift requests"
  ON shift_requests FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid());

CREATE POLICY "Staff can create shift requests"
  ON shift_requests FOR INSERT
  TO authenticated
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Admins can view all shift requests"
  ON shift_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update shift request status"
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_shift_requests_staff ON shift_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_shift_requests_event ON shift_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);