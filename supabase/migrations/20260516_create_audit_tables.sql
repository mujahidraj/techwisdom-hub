-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- e.g., 'EXPORT', 'DELETE', 'UPDATE', 'LOGIN'
    entity_name TEXT NOT NULL, -- e.g., 'CLIENT_LIST', 'INVOICE', 'PROJECT'
    entity_id TEXT,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Time & Productivity Logs Table
CREATE TABLE IF NOT EXISTS public.time_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.active_projects(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    status TEXT DEFAULT 'completed', -- 'in_progress', 'completed', 'blocked'
    hours_logged NUMERIC(5,2) DEFAULT 0.0,
    billable BOOLEAN DEFAULT true,
    notes TEXT,
    date_logged DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Setup RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audits
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Anyone can insert an audit log (for their own actions)
CREATE POLICY "Users can insert their own audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Everyone can view their own time logs, admins can view all
CREATE POLICY "Users can view time logs" ON public.time_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = time_logs.employee_id AND employees.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Users can log their own time
CREATE POLICY "Users can insert their own time logs" ON public.time_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = employee_id AND employees.user_id = auth.uid()
        )
    );
