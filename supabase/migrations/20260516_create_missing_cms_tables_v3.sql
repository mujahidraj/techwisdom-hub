-- =============================================
-- FIXING PRICING TIER SCHEMA AND ADDING EVENTS
-- =============================================

-- Drop the old table since it doesn't match the complex pricing structure
DROP TABLE IF EXISTS public.cms_pricing_tiers CASCADE;

-- Recreate pricing tiers to match the extensive data.json structure
CREATE TABLE IF NOT EXISTS public.cms_pricing_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'web', -- 'web', 'app', 'graphics', 'marketing', 'maintenance'
  tier_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2),
  monthly_price NUMERIC(12,2),
  yearly_price NUMERIC(12,2),
  features JSONB DEFAULT '[]',
  cta TEXT,
  highlighted BOOLEAN DEFAULT false,
  badge TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Events table for the employee dashboard (Replacing Schedule)
CREATE TABLE IF NOT EXISTS public.company_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.cms_pricing_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_cms_pricing_tiers" ON public.cms_pricing_tiers;
DROP POLICY IF EXISTS "insert_cms_pricing_tiers" ON public.cms_pricing_tiers;
DROP POLICY IF EXISTS "update_cms_pricing_tiers" ON public.cms_pricing_tiers;
DROP POLICY IF EXISTS "delete_cms_pricing_tiers" ON public.cms_pricing_tiers;
CREATE POLICY "read_cms_pricing_tiers" ON public.cms_pricing_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_cms_pricing_tiers" ON public.cms_pricing_tiers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_cms_pricing_tiers" ON public.cms_pricing_tiers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_cms_pricing_tiers" ON public.cms_pricing_tiers FOR DELETE TO authenticated USING (true);

ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_company_events" ON public.company_events;
DROP POLICY IF EXISTS "insert_company_events" ON public.company_events;
DROP POLICY IF EXISTS "update_company_events" ON public.company_events;
DROP POLICY IF EXISTS "delete_company_events" ON public.company_events;
CREATE POLICY "read_company_events" ON public.company_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_company_events" ON public.company_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_company_events" ON public.company_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_company_events" ON public.company_events FOR DELETE TO authenticated USING (true);

-- Triggers
DROP TRIGGER IF EXISTS trg_cms_pricing_tiers ON public.cms_pricing_tiers;
CREATE TRIGGER trg_cms_pricing_tiers BEFORE UPDATE ON public.cms_pricing_tiers FOR EACH ROW EXECUTE FUNCTION update_cms_updated_at();

DROP TRIGGER IF EXISTS trg_company_events ON public.company_events;
CREATE TRIGGER trg_company_events BEFORE UPDATE ON public.company_events FOR EACH ROW EXECUTE FUNCTION update_cms_updated_at();
