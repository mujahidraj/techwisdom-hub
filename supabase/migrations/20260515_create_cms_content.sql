-- =============================================
-- COMPLETE CMS MODULE — ALL CONTENT TABLES
-- Run in Supabase Dashboard → SQL Editor
-- =============================================

-- ========== 1. TEAM MEMBERS ==========
CREATE TABLE IF NOT EXISTS public.cms_team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT,
  image TEXT,
  linkedin TEXT,
  email TEXT,
  portfolio TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 2. SERVICES (cards) ==========
CREATE TABLE IF NOT EXISTS public.cms_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  icon TEXT,
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 3. SERVICE DETAILS (full pages) ==========
CREATE TABLE IF NOT EXISTS public.cms_service_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES public.cms_services(service_id) ON DELETE CASCADE,
  tagline TEXT,
  hero_image TEXT,
  overview TEXT,
  deliverables TEXT[] DEFAULT '{}',
  process JSONB DEFAULT '[]',
  tech_stack TEXT[] DEFAULT '{}',
  benefits TEXT[] DEFAULT '{}',
  faqs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 4. PORTFOLIO (case studies) ==========
CREATE TABLE IF NOT EXISTS public.cms_portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  thumbnail TEXT,
  challenge TEXT,
  solution TEXT,
  tech_stack TEXT[] DEFAULT '{}',
  results JSONB DEFAULT '[]',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 5. BLOG POSTS ==========
CREATE TABLE IF NOT EXISTS public.cms_blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  category TEXT,
  author TEXT,
  publish_date DATE DEFAULT CURRENT_DATE,
  read_time TEXT,
  image TEXT,
  content JSONB DEFAULT '[]',
  is_published BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 6. PARTNERS ==========
CREATE TABLE IF NOT EXISTS public.cms_partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT NOT NULL,
  website TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 7. TIMELINE ==========
CREATE TABLE IF NOT EXISTS public.cms_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 8. GALLERY ==========
CREATE TABLE IF NOT EXISTS public.cms_gallery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  src TEXT NOT NULL,
  alt TEXT,
  title TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 9. PRICING TIERS ==========
CREATE TABLE IF NOT EXISTS public.cms_pricing_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_id TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC DEFAULT 0,
  monthly_price NUMERIC,
  yearly_price NUMERIC,
  features TEXT[] DEFAULT '{}',
  cta TEXT DEFAULT 'Start Project',
  highlighted BOOLEAN DEFAULT false,
  badge TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 10. JOB OPENINGS (Recruitment) ==========
CREATE TABLE IF NOT EXISTS public.cms_job_openings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Remote',
  type TEXT NOT NULL DEFAULT 'Full-time',
  short_description TEXT,
  about_role TEXT,
  responsibilities TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  salary TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INT DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 11. DEMO PROJECTS (Showcase) ==========
CREATE TABLE IF NOT EXISTS public.cms_demo_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  image TEXT,
  short_description TEXT,
  full_description TEXT,
  live_link TEXT,
  tech_stack TEXT[] DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  design_unique TEXT,
  development_process TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INT DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 12. PRODUCT CATALOG ==========
CREATE TABLE IF NOT EXISTS public.cms_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  developer TEXT DEFAULT 'TechWisdom Technologies',
  tagline TEXT,
  summary TEXT,
  hero_image TEXT,
  gallery TEXT[] DEFAULT '{}',
  overview TEXT,
  highlights TEXT[] DEFAULT '{}',
  capabilities TEXT[] DEFAULT '{}',
  built_for TEXT,
  status TEXT DEFAULT 'Production ready',
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INT DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 13. SITE SETTINGS (key-value config) ==========
CREATE TABLE IF NOT EXISTS public.cms_site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== RLS FOR ALL TABLES ==========
DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cms_team_members','cms_services','cms_service_details','cms_portfolio',
    'cms_blog_posts','cms_partners','cms_timeline','cms_gallery',
    'cms_pricing_tiers','cms_job_openings','cms_demo_projects',
    'cms_products','cms_site_settings'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "read_%s" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "insert_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "update_%s" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "delete_%s" ON public.%I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- ========== UPDATED_AT TRIGGERS ==========
CREATE OR REPLACE FUNCTION update_cms_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cms_team_members','cms_services','cms_service_details','cms_portfolio',
    'cms_blog_posts','cms_pricing_tiers','cms_job_openings',
    'cms_demo_projects','cms_products'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_cms_updated_at()', t, t);
  END LOOP;
END $$;

-- ========== SEED SITE SETTINGS KEYS ==========
INSERT INTO public.cms_site_settings (setting_key, setting_value) VALUES
  ('site', '{"name":"TechWisdom Technologies","tagline":"We don''t just code, we create solution.","email":"official@techwisdom.site","phone":"+8801799269699","address":"158/Cha, Kuratoli Rd, Dhaka 1229, Bangladesh"}'),
  ('hero', '{"headline":"We don''t just code, we create solution","subheadline":"We transform bold ideas into exceptional digital experiences."}'),
  ('about', '{"mission":"Redefining digital experience...","vision":"To become the cornerstone of success..."}'),
  ('contact', '{"headline":"Let''s Build Something Amazing","subheadline":"Ready to transform your digital presence?"}'),
  ('footer', '{"description":"We craft premium digital experiences that drive growth."}'),
  ('careers', '{"headline":"Build the Future with Us","subheadline":"Join our team of innovators."}')
ON CONFLICT (setting_key) DO NOTHING;
