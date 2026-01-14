/*
  # Fix Infinite Recursion in Profiles Policies

  ## Overview
  Fixes the infinite recursion error in profiles RLS policies by simplifying the admin check.

  ## Changes
  
  ### 1. Drop Problematic Policies
  - Remove policies that cause infinite recursion by querying profiles within profiles policy
  
  ### 2. Create New Safe Policies
  - Simple policy for users to view/update their own profile
  - Separate admin policy using a security definer function to avoid recursion
  
  ## Notes
  - The function `is_admin()` uses SECURITY DEFINER to bypass RLS when checking admin status
  - This breaks the recursion cycle while maintaining security
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create a helper function to check if current user is admin (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Create new SELECT policy without recursion
CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR is_admin()
  );

-- Create new UPDATE policy without recursion
CREATE POLICY "Users can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() OR is_admin()
  )
  WITH CHECK (
    id = auth.uid() OR is_admin()
  );

-- Create INSERT policy for new user registration
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
  );