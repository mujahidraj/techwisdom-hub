-- =============================================
-- FIXING SCHEMA MISMATCHES (V4)
-- =============================================

-- Fix cms_site_info
ALTER TABLE public.cms_site_info DROP COLUMN IF EXISTS logo;
ALTER TABLE public.cms_site_info ADD COLUMN IF NOT EXISTS image TEXT;

-- Drop obsolete fields in hero
ALTER TABLE public.cms_hero_section DROP COLUMN IF EXISTS cta_secondary;

-- Fix partners (ensure it uses logo, not logo_url or something else)
ALTER TABLE public.cms_partners DROP COLUMN IF EXISTS logo_url;
ALTER TABLE public.cms_partners ADD COLUMN IF NOT EXISTS logo TEXT;
