-- ============================================
-- TechWisdom ERP V4 - New Features Migration
-- Tables: kanban_tasks, kpi_widgets (activity_log unified under audit_logs)
-- ============================================

-- 1. DROP LEGACY ACTIVITY LOG TABLE
DROP TABLE IF EXISTS activity_log CASCADE;


-- 2. KANBAN TASKS TABLE (Task Board)
CREATE TABLE IF NOT EXISTS kanban_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',     -- 'todo', 'in_progress', 'review', 'completed'
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  due_date TIMESTAMPTZ,
  assigned_to_name TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast board queries
CREATE INDEX IF NOT EXISTS idx_kanban_tasks_status ON kanban_tasks(status, position);

-- Enable RLS
ALTER TABLE kanban_tasks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read kanban_tasks" ON kanban_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert kanban_tasks" ON kanban_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update kanban_tasks" ON kanban_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete kanban_tasks" ON kanban_tasks FOR DELETE TO authenticated USING (true);


-- 3. KPI WIDGETS TABLE (Custom KPI Dashboard)
CREATE TABLE IF NOT EXISTS kpi_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,          -- e.g., 'total_leads', 'active_projects', 'net_profit'
  custom_label TEXT,                  -- Optional override label
  position INTEGER NOT NULL DEFAULT 0,
  config JSONB,                       -- Extra config like goal values
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_kpi_widgets_user ON kpi_widgets(user_id, position);

-- Enable RLS
ALTER TABLE kpi_widgets ENABLE ROW LEVEL SECURITY;

-- Policies: user can only manage their own widgets
CREATE POLICY "Users can read own kpi_widgets" ON kpi_widgets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own kpi_widgets" ON kpi_widgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own kpi_widgets" ON kpi_widgets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own kpi_widgets" ON kpi_widgets FOR DELETE TO authenticated USING (auth.uid() = user_id);
