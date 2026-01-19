-- Create project_stage enum
CREATE TYPE public.project_stage AS ENUM (
  'discovery',
  'requirement', 
  'strategy',
  'design',
  'development',
  'qa',
  'deployment',
  'maintenance'
);

-- Create project_status enum
CREATE TYPE public.project_status AS ENUM (
  'active',
  'completed',
  'on_hold',
  'cancelled'
);

-- Create active_projects table
CREATE TABLE public.active_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES auth.users(id),
  client_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT NOT NULL,
  total_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE,
  stage project_stage NOT NULL DEFAULT 'discovery',
  status project_status NOT NULL DEFAULT 'active',
  lead_id UUID REFERENCES public.leads(id),
  domain_purchased BOOLEAN DEFAULT FALSE,
  ssl_active BOOLEAN DEFAULT FALSE,
  credentials_sent BOOLEAN DEFAULT FALSE,
  retainer_paid BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.active_projects ENABLE ROW LEVEL SECURITY;

-- Create policies for active_projects
CREATE POLICY "Admins can do everything with projects"
ON public.active_projects FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view projects"
ON public.active_projects FOR SELECT
USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Clients can view their own projects"
ON public.active_projects FOR SELECT
USING (auth.uid() = client_id);

-- Create project_updates table
CREATE TABLE public.project_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.active_projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage project updates"
ON public.project_updates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view project updates"
ON public.project_updates FOR SELECT
USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Clients can view their project updates"
ON public.project_updates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.active_projects 
    WHERE id = project_updates.project_id 
    AND client_id = auth.uid()
  )
);

-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  designation TEXT NOT NULL,
  department TEXT,
  phone TEXT,
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'terminated')),
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all employees"
ON public.employees FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view their own record"
ON public.employees FOR SELECT
USING (auth.uid() = user_id);

-- Create payroll_log table
CREATE TABLE public.payroll_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bonus NUMERIC(12,2) DEFAULT 0,
  deduction NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll"
ON public.payroll_log FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view their own payroll"
ON public.payroll_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = payroll_log.employee_id 
    AND user_id = auth.uid()
  )
);

-- Create expense_category enum
CREATE TYPE public.expense_category AS ENUM (
  'rent',
  'server',
  'software',
  'marketing',
  'salary',
  'utilities',
  'office_supplies',
  'travel',
  'other'
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category expense_category NOT NULL DEFAULT 'other',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage expenses"
ON public.expenses FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view expenses"
ON public.expenses FOR SELECT
USING (has_role(auth.uid(), 'employee'::app_role));

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.active_projects(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invoices"
ON public.invoices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view their project invoices"
ON public.invoices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.active_projects 
    WHERE id = invoices.project_id 
    AND client_id = auth.uid()
  )
);

-- Create client_messages table
CREATE TABLE public.client_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  project_id UUID REFERENCES public.active_projects(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all messages"
ON public.client_messages FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can send messages"
ON public.client_messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view messages for their projects"
ON public.client_messages FOR SELECT
USING (
  auth.uid() = sender_id OR
  EXISTS (
    SELECT 1 FROM public.active_projects 
    WHERE id = client_messages.project_id 
    AND client_id = auth.uid()
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_active_projects_updated_at
BEFORE UPDATE ON public.active_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for client_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_messages;