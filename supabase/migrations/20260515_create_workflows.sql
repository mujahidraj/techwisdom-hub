-- =============================================
-- WORKFLOW AUTOMATION MODULE
-- Run in Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Workflow steps (actions)
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
  step_order INT NOT NULL DEFAULT 1,
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Execution log
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
  trigger_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'running' NOT NULL,
  steps_completed INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- 4. RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view workflows" ON public.workflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert workflows" ON public.workflows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update workflows" ON public.workflows FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can delete workflows" ON public.workflows FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth users can view steps" ON public.workflow_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert steps" ON public.workflow_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update steps" ON public.workflow_steps FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can delete steps" ON public.workflow_steps FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth users can view executions" ON public.workflow_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert executions" ON public.workflow_executions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update executions" ON public.workflow_executions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workflows_timestamp ON public.workflows;
CREATE TRIGGER update_workflows_timestamp
  BEFORE UPDATE ON public.workflows FOR EACH ROW
  EXECUTE FUNCTION update_workflows_updated_at();
