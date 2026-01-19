-- Update portfolio table with new fields
ALTER TABLE public.portfolio 
ADD COLUMN IF NOT EXISTS thumbnail text,
ADD COLUMN IF NOT EXISTS challenge text,
ADD COLUMN IF NOT EXISTS solution text,
ADD COLUMN IF NOT EXISTS tech_stack text[],
ADD COLUMN IF NOT EXISTS results jsonb;

-- Update services table with new fields  
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS short_description text;

-- Update pricing_tiers table with new fields
ALTER TABLE public.pricing_tiers
ADD COLUMN IF NOT EXISTS tier_id text,
ADD COLUMN IF NOT EXISTS cta text DEFAULT 'Start Project',
ADD COLUMN IF NOT EXISTS highlighted boolean DEFAULT false;