-- =============================================
-- MISSING CMS MODULE TABLES
-- Run in Supabase Dashboard -> SQL Editor
-- =============================================

-- ========== 14. SITE INFO ==========
CREATE TABLE IF NOT EXISTS public.cms_site_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  address TEXT,
  logo JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 15. NAVIGATION ==========
CREATE TABLE IF NOT EXISTS public.cms_navigation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 16. HERO SECTION ==========
CREATE TABLE IF NOT EXISTS public.cms_hero_section (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  subheadline TEXT,
  cta_primary TEXT,
  cta_secondary TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 17. STATS ==========
CREATE TABLE IF NOT EXISTS public.cms_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  value NUMERIC NOT NULL,
  suffix TEXT,
  label TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 18. WHY US ==========
CREATE TABLE IF NOT EXISTS public.cms_why_us (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 19. ABOUT SECTION ==========
CREATE TABLE IF NOT EXISTS public.cms_about_section (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_title TEXT,
  mission_content TEXT,
  vision_title TEXT,
  vision_content TEXT,
  goals TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 20. COST ESTIMATOR SETTINGS ==========
CREATE TABLE IF NOT EXISTS public.cms_cost_estimator (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  steps JSONB DEFAULT '[]',
  result_title TEXT,
  result_email_placeholder TEXT,
  result_button_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== RLS FOR NEW TABLES ==========
DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cms_site_info','cms_navigation','cms_hero_section','cms_stats',
    'cms_why_us','cms_about_section','cms_cost_estimator'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "read_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "insert_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "update_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "delete_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "read_%s" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "insert_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "update_%s" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "delete_%s" ON public.%I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- ========== UPDATED_AT TRIGGERS ==========
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cms_site_info','cms_navigation','cms_hero_section','cms_stats',
    'cms_why_us','cms_about_section','cms_cost_estimator'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_cms_updated_at()', t, t);
  END LOOP;
END $$;
