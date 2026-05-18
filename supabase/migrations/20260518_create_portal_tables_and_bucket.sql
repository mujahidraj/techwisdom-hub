-- ============================================================
-- TechWisdom ERP V4 - Create Portal Tables & Storage Bucket
-- ============================================================

-- 1. Create Enums if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_type') THEN
    CREATE TYPE public.announcement_type AS ENUM ('general', 'event', 'hr', 'urgent');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    CREATE TYPE public.document_type AS ENUM ('contract', 'payslip', 'policy', 'tax', 'other');
  END IF;
END $$;

-- 2. Create company_announcements table
CREATE TABLE IF NOT EXISTS public.company_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type public.announcement_type NOT NULL DEFAULT 'general',
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create employee_documents table
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_url TEXT,
  type public.document_type NOT NULL DEFAULT 'other',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.company_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- 5. Drop policies if exist to prevent errors
DROP POLICY IF EXISTS "Allow authenticated to view announcements" ON public.company_announcements;
DROP POLICY IF EXISTS "Allow admins to manage announcements" ON public.company_announcements;
DROP POLICY IF EXISTS "Allow users to view own documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Allow admins to manage all documents" ON public.employee_documents;

-- 6. Policies for company_announcements
CREATE POLICY "Allow authenticated to view announcements"
  ON public.company_announcements FOR SELECT
  TO authenticated
  USING (is_published = true);

CREATE POLICY "Allow admins to manage announcements"
  ON public.company_announcements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. Policies for employee_documents
CREATE POLICY "Allow users to view own documents"
  ON public.employee_documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow admins to manage all documents"
  ON public.employee_documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Register the 'employee-documents' storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('employee-documents', 'employee-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage policies for employee-documents
DROP POLICY IF EXISTS "Allow authenticated download employee-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins upload/delete employee-documents" ON storage.objects;

CREATE POLICY "Allow authenticated download employee-documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-documents');

CREATE POLICY "Allow admins upload/delete employee-documents"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'employee-documents' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'employee-documents' AND public.has_role(auth.uid(), 'admin'));
