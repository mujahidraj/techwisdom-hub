-- 1. Create or recreate robust app role check helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role text)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role::public.app_role
  )
$$;

-- 2. Enable Row Level Security (RLS) on performance_reviews
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

-- Clean drop any existing policies to avoid duplicates or conflicts
DROP POLICY IF EXISTS "Admins can manage all performance reviews" ON public.performance_reviews;
DROP POLICY IF EXISTS "Employees can view their own reviews" ON public.performance_reviews;
DROP POLICY IF EXISTS "Reviewers can insert reviews" ON public.performance_reviews;
DROP POLICY IF EXISTS "Reviewers can update their drafted reviews" ON public.performance_reviews;

-- 3. Admins have complete administrative privileges over all reviews
CREATE POLICY "Admins can manage all performance reviews"
  ON public.performance_reviews FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Employees and designated Reviewers can view their respective review records
CREATE POLICY "Employees can view their own reviews"
  ON public.performance_reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = employee_id OR auth.uid() = reviewer_id);

-- 5. Reviewers can insert new performance reviews where they are assigned as the author
CREATE POLICY "Reviewers can insert reviews"
  ON public.performance_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- 6. Reviewers can modify/update reviews that they authored
CREATE POLICY "Reviewers can update their drafted reviews"
  ON public.performance_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);
