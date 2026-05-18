-- Migration: Fix profiles constraint and signup trigger insertion
-- 1. Enable pgcrypto extension to ensure gen_random_uuid() works perfectly
-- 2. Repair profiles.id and user_roles.id column defaults
-- 3. Redefines handle_new_user trigger function to populate columns explicitly
-- 4. Explicitly drops and recreates the on_auth_user_created trigger as AFTER INSERT to satisfy foreign key constraints!

-- Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Set defaults on tables if missing
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.user_roles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Redefine trigger function to insert all fields explicitly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles explicitly passing id and user_id as NEW.id
  INSERT INTO public.profiles (id, user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Insert into user_roles explicitly passing a generated UUID
  INSERT INTO public.user_roles (id, user_id, role)
  VALUES (
    gen_random_uuid(), 
    NEW.id, 
    'employee'
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Explicitly drop the trigger if it exists (removes any BEFORE/AFTER misconfigurations)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the trigger strictly as AFTER INSERT so NEW.id exists in auth.users during execution
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Clean up orphaned profile records that don't belong to any active auth user
DELETE FROM public.profiles 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Repair all existing rows where id is mismatched or null, setting id = user_id
UPDATE public.profiles 
SET id = user_id 
WHERE id IS NULL OR id != user_id;
