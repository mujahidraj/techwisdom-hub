-- Create leave type enum
CREATE TYPE public.leave_type AS ENUM ('annual', 'sick', 'personal', 'unpaid', 'maternity', 'paternity', 'other');

-- Create leave status enum
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Create leave applications table
CREATE TABLE public.leave_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status leave_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

-- Employees can view their own leave applications
CREATE POLICY "Employees can view their own leave applications"
ON public.leave_applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE employees.id = leave_applications.employee_id
    AND employees.user_id = auth.uid()
  )
);

-- Employees can insert their own leave applications
CREATE POLICY "Employees can insert their own leave applications"
ON public.leave_applications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE employees.id = leave_applications.employee_id
    AND employees.user_id = auth.uid()
  )
);

-- Employees can update their pending leave applications (cancel)
CREATE POLICY "Employees can update their pending leave applications"
ON public.leave_applications
FOR UPDATE
USING (
  status = 'pending' AND
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE employees.id = leave_applications.employee_id
    AND employees.user_id = auth.uid()
  )
);

-- Admins can manage all leave applications
CREATE POLICY "Admins can manage all leave applications"
ON public.leave_applications
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_leave_applications_updated_at
BEFORE UPDATE ON public.leave_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add leave_type and leave_status to Constants in the app