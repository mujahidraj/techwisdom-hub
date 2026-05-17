-- 1. Add dedicated explicit columns to the proposals table for robust tracking
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS execution_scope TEXT,
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT,
ADD COLUMN IF NOT EXISTS footnote TEXT,
ADD COLUMN IF NOT EXISTS client_code TEXT,
ADD COLUMN IF NOT EXISTS contact_person TEXT,
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- 2. Create a dedicated table for Upsell Suggestions / Add-ons to avoid JSON blobs
CREATE TABLE IF NOT EXISTS proposal_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS on the new suggestions table
ALTER TABLE proposal_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read proposal_suggestions" ON proposal_suggestions;
CREATE POLICY "Allow authenticated users to read proposal_suggestions" ON proposal_suggestions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert proposal_suggestions" ON proposal_suggestions;
CREATE POLICY "Allow authenticated users to insert proposal_suggestions" ON proposal_suggestions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update proposal_suggestions" ON proposal_suggestions;
CREATE POLICY "Allow authenticated users to update proposal_suggestions" ON proposal_suggestions FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete proposal_suggestions" ON proposal_suggestions;
CREATE POLICY "Allow authenticated users to delete proposal_suggestions" ON proposal_suggestions FOR DELETE TO authenticated USING (true);

-- 4. Create a dedicated 'proposals' storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public) VALUES ('proposals', 'proposals', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Set up storage policies for the proposals bucket
DROP POLICY IF EXISTS "Proposals bucket is publicly accessible" ON storage.objects;
CREATE POLICY "Proposals bucket is publicly accessible" 
ON storage.objects FOR SELECT USING (bucket_id = 'proposals');

DROP POLICY IF EXISTS "Authenticated users can upload proposal PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can upload proposal PDFs" 
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'proposals');

DROP POLICY IF EXISTS "Authenticated users can update proposal PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can update proposal PDFs" 
ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'proposals');

DROP POLICY IF EXISTS "Authenticated users can delete proposal PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can delete proposal PDFs" 
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'proposals');
