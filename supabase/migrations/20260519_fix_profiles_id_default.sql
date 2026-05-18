-- Migration: Fix profiles constraint and signup trigger insertion
-- 1. Redefines the handle_new_user trigger to populate both id and user_id as NEW.id
-- 2. Deletes any orphaned profiles where user_id does not exist in auth.users (prevents update crashes)
-- 3. Repairs all existing rows in public.profiles by mapping id = user_id to satisfy the foreign key constraint.

-- Redefine trigger function to insert id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, email, full_name)
  VALUES (NEW.id, NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  -- Default role is employee
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Clean up orphaned profile records that don't belong to any valid auth user
DELETE FROM public.profiles 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Repair all existing rows where id is mismatched or null, setting id = user_id
UPDATE public.profiles 
SET id = user_id 
WHERE id IS NULL OR id != user_id;
