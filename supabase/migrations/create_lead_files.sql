-- ============================================================
-- TechWisdom ERP V4 - Create Lead Files Table & Storage Bucket
-- ============================================================

-- 1. Create the lead_files table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.lead_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create index for fast queries by lead_id
CREATE INDEX IF NOT EXISTS idx_lead_files_lead ON public.lead_files(lead_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.lead_files ENABLE ROW LEVEL SECURITY;

-- 4. Drop any existing policies to prevent clash errors
DROP POLICY IF EXISTS "Allow authenticated users to read lead files" ON public.lead_files;
DROP POLICY IF EXISTS "Allow authenticated users to insert lead files" ON public.lead_files;
DROP POLICY IF EXISTS "Allow authenticated users to delete lead files" ON public.lead_files;

-- 5. Policies for Authenticated Users
CREATE POLICY "Allow authenticated users to read lead files" 
  ON public.lead_files FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated users to insert lead files" 
  ON public.lead_files FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete lead files" 
  ON public.lead_files FOR DELETE 
  TO authenticated 
  USING (true);

-- 6. Ensure the 'lead-attachments' storage bucket is registered
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lead-attachments', 'lead-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Ensure storage policies exist for lead-attachments
DROP POLICY IF EXISTS "Allow authenticated users to read lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to insert lead attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete lead attachments" ON storage.objects;

CREATE POLICY "Allow authenticated users to read lead attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lead-attachments');

CREATE POLICY "Allow authenticated users to insert lead attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lead-attachments');

CREATE POLICY "Allow authenticated users to delete lead attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lead-attachments');
