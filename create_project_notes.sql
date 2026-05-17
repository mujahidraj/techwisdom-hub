-- ============================================
-- TechWisdom ERP V4 - Create Project Notes Table
-- ============================================

-- Create the project_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES active_projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries by project_id
CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_notes(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Users (Admins, Employees, Clients)
CREATE POLICY "Allow authenticated users to read project notes" 
  ON project_notes FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated users to insert project notes" 
  ON project_notes FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete project notes" 
  ON project_notes FOR DELETE 
  TO authenticated 
  USING (true);
