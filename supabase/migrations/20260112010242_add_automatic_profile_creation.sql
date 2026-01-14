/*
  # Add Automatic Profile Creation

  ## Overview
  Creates a trigger to automatically create a profile when a user signs up through Supabase Auth.

  ## Changes
  
  ### 1. Create Trigger Function
  - Automatically creates a profile entry when a new user is created
  - Sets default values for new staff members
  
  ### 2. Create Trigger
  - Fires after insert on auth.users
  - Ensures every authenticated user has a profile
  
  ## Notes
  - New users default to 'staff' role and need admin validation
  - This prevents profile loading errors for newly created accounts
*/

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, is_validated)
  VALUES (
    NEW.id,
    NEW.email,
    'staff',
    false
  );
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();