import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivityLog } from '@/hooks/useActivityLog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'active_projects'>;

import { projectTypes, getStagesForType, formatLabel, getProjectTypeGroups } from '@/config/projectConfig';

const statuses = ['active', 'completed', 'on_hold', 'cancelled'];

const schema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  client_name: z.string().min(1, 'Client name is required'),
  client_id: z.string().optional(),
  project_type: z.string().min(1, 'Project type is required'),
  total_budget: z.string().min(1, 'Budget is required'),
  paid_amount: z.string(),
  stage: z.string().min(1, 'Stage is required'),
  status: z.string().min(1, 'Status is required'),
  deadline: z.string().optional(),
  domain_purchased: z.boolean(),
  ssl_active: z.boolean(),
  credentials_sent: z.boolean(),
  retainer_paid: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface ClientUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

interface EditProjectDialogProps {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
}

export function EditProjectDialog({ project, onOpenChange }: EditProjectDialogProps) {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();

  // Fetch client users
  const { data: clients = [] } = useQuery({
    queryKey: ['client-users'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'client');
      
      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);
      
      if (profilesError) throw profilesError;
      return (profiles || []) as ClientUser[];
    },
    enabled: !!project,
  });

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const { data: currentAssignments = [] } = useQuery({
    queryKey: ['project-assignments-edit', project?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('project_assignments' as any)
        .select('employee_id')
        .eq('project_id', project!.id) as any);
      if (error) throw error;
      return (data || []).map((a: any) => a.employee_id);
    },
    enabled: !!project?.id
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list-edit'],
    queryFn: async () => {
      const { data: emps, error: empErr } = await supabase.from('employees').select('id, designation, user_id');
      const { data: profs, error: profErr } = await supabase.from('profiles').select('user_id, full_name, avatar_url');
      if (empErr || profErr) throw empErr || profErr;

      return emps.map(emp => {
        const profile = profs.find(p => p.user_id === emp.user_id);
        return {
          id: emp.id,
          designation: emp.designation,
          full_name: profile?.full_name || 'Unnamed Employee',
          avatar_url: profile?.avatar_url
        };
      });
    },
    enabled: !!project,
  });

  useEffect(() => {
    if (currentAssignments.length > 0) {
      setSelectedEmployees(currentAssignments);
    } else {
      setSelectedEmployees([]);
    }
  }, [currentAssignments, project]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_name: '',
      client_name: '',
      client_id: '',
      project_type: '',
      total_budget: '',
      paid_amount: '0',
      stage: 'discovery',
      status: 'active',
      deadline: '',
      domain_purchased: false,
      ssl_active: false,
      credentials_sent: false,
      retainer_paid: false,
    },
  });

  useEffect(() => {
    if (project) {
      form.reset({
        project_name: project.project_name,
        client_name: project.client_name,
        client_id: project.client_id || '',
        project_type: project.project_type,
        total_budget: String(project.total_budget),
        paid_amount: String(project.paid_amount),
        stage: project.stage,
        status: project.status,
        deadline: project.deadline || '',
        domain_purchased: project.domain_purchased || false,
        ssl_active: project.ssl_active || false,
        credentials_sent: project.credentials_sent || false,
        retainer_paid: project.retainer_paid || false,
      });
    }
  }, [project, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase
        .from('active_projects')
        .update({
          project_name: data.project_name,
          client_name: data.client_name,
          client_id: data.client_id || null,
          project_type: data.project_type,
          total_budget: parseFloat(data.total_budget),
          paid_amount: parseFloat(data.paid_amount),
          stage: data.stage as any,
          status: data.status as any,
          deadline: data.deadline || null,
          domain_purchased: data.domain_purchased,
          ssl_active: data.ssl_active,
          credentials_sent: data.credentials_sent,
          retainer_paid: data.retainer_paid,
        })
        .eq('id', project!.id);

      if (error) throw error;

      // Delete old assignments
      const { error: deleteError } = await supabase
        .from('project_assignments' as any)
        .delete()
        .eq('project_id', project!.id);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (selectedEmployees.length > 0) {
        const assignments = selectedEmployees.map(empId => ({
          project_id: project!.id,
          employee_id: empId
        }));
        const { error: assignError } = await supabase.from('project_assignments' as any).insert(assignments);
        if (assignError) throw assignError;
      }
    },
    onSuccess: () => {
      if (project) {
        logActivity('updated', 'project', project.project_name, project.id);
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project_assigned_employees', project?.id] });
      toast.success('Project updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to update project: ' + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const currentStage = form.watch('stage');

  return (
    <Dialog open={!!project} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project_name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign Client User</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === 'none' ? '' : val)} 
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No client assigned</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.user_id} value={client.user_id}>
                            {client.full_name || client.email || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="project_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(getProjectTypeGroups()).map(([group, types]) => (
                          <div key={group}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
                            {types.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status} className="capitalize">
                            {status.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Stage *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getStagesForType(form.watch('project_type')).map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {formatLabel(stage)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="total_budget"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Total Budget (৳) *</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paid_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid Amount (৳)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Deadline</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assign Employees */}
              <div className="col-span-2 space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Assign Employees to Project</Label>
                <div className="border rounded-xl p-3 bg-muted/10 max-h-40 overflow-y-auto space-y-2.5">
                  {employees.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1 font-medium">No employees found.</p>
                  ) : (
                    employees.map((emp: any) => (
                      <div key={emp.id} className="flex items-center space-x-3 p-1 rounded-lg hover:bg-muted/30 transition-colors">
                        <Checkbox
                          id={`emp-edit-${emp.id}`}
                          checked={selectedEmployees.includes(emp.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedEmployees([...selectedEmployees, emp.id]);
                            } else {
                              setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                            }
                          }}
                          className="rounded h-4 w-4"
                        />
                        <Label htmlFor={`emp-edit-${emp.id}`} className="text-xs font-normal cursor-pointer flex-1 flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{emp.full_name}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{emp.designation}</span>
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Deployment Checklist */}
              {currentStage === 'deployment' && (
                <div className="col-span-2 p-4 border rounded-lg space-y-3">
                  <h4 className="font-medium">Deployment Checklist</h4>
                  <FormField
                    control={form.control}
                    name="domain_purchased"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">Domain Purchased</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ssl_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">SSL Active</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="credentials_sent"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">Credentials Sent</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Maintenance Retainer */}
              {currentStage === 'maintenance' && (
                <div className="col-span-2 p-4 border rounded-lg">
                  <FormField
                    control={form.control}
                    name="retainer_paid"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">Retainer Paid?</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
