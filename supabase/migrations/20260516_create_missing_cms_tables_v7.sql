-- =============================================
-- FIXING MISSING ID MAPPINGS (V7)
-- =============================================

-- Add unique text IDs for routing
ALTER TABLE public.cms_demo_projects ADD COLUMN IF NOT EXISTS project_id TEXT UNIQUE;
ALTER TABLE public.cms_products ADD COLUMN IF NOT EXISTS product_id TEXT UNIQUE;
ALTER TABLE public.cms_job_openings ADD COLUMN IF NOT EXISTS job_id TEXT UNIQUE;
