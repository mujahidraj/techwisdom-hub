-- =============================================
-- ADDING MISSING FIELDS FOR PRODUCT CATALOG (V5)
-- =============================================

ALTER TABLE public.cms_products
ADD COLUMN IF NOT EXISTS comparison JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pricing JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS web_app_url TEXT,
ADD COLUMN IF NOT EXISTS app_store_url TEXT,
ADD COLUMN IF NOT EXISTS play_store_url TEXT;
