-- =============================================
-- MISSING CMS MODULE TABLES (PART 2)
-- =============================================

-- ========== 21. PROCESS ==========
CREATE TABLE IF NOT EXISTS public.cms_process (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  step INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 22. CONTACT INFO ==========
CREATE TABLE IF NOT EXISTS public.cms_contact_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  subheadline TEXT,
  form_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 23. FOOTER INFO ==========
CREATE TABLE IF NOT EXISTS public.cms_footer_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT,
  social_links JSONB DEFAULT '[]',
  legal_links JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 24. NOT FOUND PAGE ==========
CREATE TABLE IF NOT EXISTS public.cms_not_found (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cta TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 25. CAREER PAGE ==========
CREATE TABLE IF NOT EXISTS public.cms_career_page (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  subheadline TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== 26. CAREER PERKS ==========
CREATE TABLE IF NOT EXISTS public.cms_career_perks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========== RLS FOR NEW TABLES ==========
DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cms_process','cms_contact_info','cms_footer_info','cms_not_found',
    'cms_career_page','cms_career_perks'
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
    'cms_process','cms_contact_info','cms_footer_info','cms_not_found',
    'cms_career_page','cms_career_perks'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_cms_updated_at()', t, t);
  END LOOP;
END $$;
