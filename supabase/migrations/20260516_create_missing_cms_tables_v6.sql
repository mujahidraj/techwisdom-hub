-- =============================================
-- CREATING FINAL MISSING CMS TABLES (V6)
-- =============================================

-- 1. Process
CREATE TABLE IF NOT EXISTS public.cms_process (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  step INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Career Page
CREATE TABLE IF NOT EXISTS public.cms_career_page (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  subheadline TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Career Perks
CREATE TABLE IF NOT EXISTS public.cms_career_perks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Contact Info
CREATE TABLE IF NOT EXISTS public.cms_contact_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  subheadline TEXT,
  form_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Footer Info
CREATE TABLE IF NOT EXISTS public.cms_footer_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT,
  social_links JSONB DEFAULT '[]',
  legal_links JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. Not Found Page
CREATE TABLE IF NOT EXISTS public.cms_not_found (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cta TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS for all new tables
ALTER TABLE public.cms_process ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_career_page ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_career_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_contact_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_footer_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_not_found ENABLE ROW LEVEL SECURITY;

-- Add read policies (public access for CMS data)
CREATE POLICY "read_cms_process" ON public.cms_process FOR SELECT USING (true);
CREATE POLICY "read_cms_career_page" ON public.cms_career_page FOR SELECT USING (true);
CREATE POLICY "read_cms_career_perks" ON public.cms_career_perks FOR SELECT USING (true);
CREATE POLICY "read_cms_contact_info" ON public.cms_contact_info FOR SELECT USING (true);
CREATE POLICY "read_cms_footer_info" ON public.cms_footer_info FOR SELECT USING (true);
CREATE POLICY "read_cms_not_found" ON public.cms_not_found FOR SELECT USING (true);

-- Add write policies for authenticated users
CREATE POLICY "write_cms_process" ON public.cms_process FOR ALL TO authenticated USING (true);
CREATE POLICY "write_cms_career_page" ON public.cms_career_page FOR ALL TO authenticated USING (true);
CREATE POLICY "write_cms_career_perks" ON public.cms_career_perks FOR ALL TO authenticated USING (true);
CREATE POLICY "write_cms_contact_info" ON public.cms_contact_info FOR ALL TO authenticated USING (true);
CREATE POLICY "write_cms_footer_info" ON public.cms_footer_info FOR ALL TO authenticated USING (true);
CREATE POLICY "write_cms_not_found" ON public.cms_not_found FOR ALL TO authenticated USING (true);
