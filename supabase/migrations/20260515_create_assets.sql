-- =============================================
-- INVENTORY / ASSET MANAGEMENT MODULE
-- Run in Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Asset Categories Enum
DO $$ BEGIN
  CREATE TYPE public.asset_status AS ENUM ('available', 'assigned', 'maintenance', 'retired', 'lost');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_condition AS ENUM ('new', 'good', 'fair', 'poor', 'damaged');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Assets Table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_name TEXT NOT NULL,
  asset_tag TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price NUMERIC(12,2) DEFAULT 0,
  warranty_expiry DATE,
  status public.asset_status DEFAULT 'available' NOT NULL,
  condition public.asset_condition DEFAULT 'new' NOT NULL,
  location TEXT,
  notes TEXT,
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Asset History / Audit Log
CREATE TABLE IF NOT EXISTS public.asset_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  performed_by UUID,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — allow all authenticated users to read, admins to write
CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update assets" ON public.assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete assets" ON public.assets FOR DELETE TO authenticated USING (true);

CREATE POLICY "Anyone can view asset history" ON public.asset_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert asset history" ON public.asset_history FOR INSERT TO authenticated WITH CHECK (true);

-- 6. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_assets_timestamp ON public.assets;
CREATE TRIGGER update_assets_timestamp
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION update_assets_updated_at();
