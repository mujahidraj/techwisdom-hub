-- =========================================================
-- TechWisdom ERP V4 - Project Assignments Table Migration
-- Enables assigning one or multiple employees to active_projects
-- =========================================================

-- Create project_assignments mapping table
CREATE TABLE IF NOT EXISTS project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES active_projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_project_employee UNIQUE(project_id, employee_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

-- Create Policies for project_assignments (Authenticated users can view/manage)
CREATE POLICY "Anyone authenticated can select project_assignments" 
  ON project_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can insert project_assignments" 
  ON project_assignments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anyone authenticated can update project_assignments" 
  ON project_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone authenticated can delete project_assignments" 
  ON project_assignments FOR DELETE TO authenticated USING (true);
