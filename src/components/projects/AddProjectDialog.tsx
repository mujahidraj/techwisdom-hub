import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { projectTypes, getStagesForType, formatLabel, getProjectTypeGroups } from '@/config/projectConfig';
import { useNotifications } from '@/hooks/useNotifications';

const schema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  client_name: z.string().min(1, 'Client name is required'),
  client_id: z.string().optional(),
  project_type: z.string().min(1, 'Project type is required'),
  total_budget: z.string().min(1, 'Budget is required'),
  paid_amount: z.string().optional(),
  stage: z.string().min(1, 'Stage is required'),
  deadline: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ClientUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddProjectDialog({ open, onOpenChange }: AddProjectDialogProps) {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { sendNotification } = useNotifications();

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
    enabled: open,
  });

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list-add'],
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
    enabled: open,
  });

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
      deadline: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: userData } = await supabase.auth.getUser();

      const { data: newProject, error } = await supabase
        .from('active_projects')
        .insert({
          project_name: data.project_name,
          client_name: data.client_name,
          client_id: data.client_id || null,
          project_type: data.project_type,
          total_budget: parseFloat(data.total_budget),
          paid_amount: parseFloat(data.paid_amount || '0'),
          stage: data.stage as any,
          deadline: data.deadline || null,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (selectedEmployees.length > 0 && newProject) {
        const assignments = selectedEmployees.map(empId => ({
          project_id: newProject.id,
          employee_id: empId
        }));
        const { error: assignError } = await supabase.from('project_assignments' as any).insert(assignments);
        if (assignError) throw assignError;
      }
      return newProject;
    },
    onSuccess: (newProject) => {
      if (newProject) {
        logActivity('created', 'project', newProject.project_name, newProject.id);
        // Notify assigned employees
        try {
          if (selectedEmployees.length > 0) {
            const userIdsToNotify = employees
              .filter((e: any) => selectedEmployees.includes(e.id))
              .map((e: any) => e.user_id)
              .filter(Boolean);

            if (userIdsToNotify.length > 0) {
              sendNotification({
                userIds: userIdsToNotify,
                title: '💼 New Project Assignment',
                message: `You have been assigned to the project "${newProject.project_name}".`,
                type: 'info',
                actionLink: `/employee-portal`
              });
            }
          }

          // Notify client user if assigned
          if (newProject.client_id) {
            sendNotification({
              userId: newProject.client_id,
              title: '📦 Project Created',
              message: `A new project "${newProject.project_name}" has been created for you.`,
              type: 'success',
              actionLink: `/client-portal?project=${newProject.id}`
            });
          }
        } catch (e) {
          console.error('Project notifications failed:', e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully');
      form.reset();
      setSelectedEmployees([]);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to create project: ' + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Project</DialogTitle>
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
                      <Input {...field} placeholder="Enter project name" />
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
                      <Input {...field} placeholder="Enter client name" />
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
                          <SelectValue placeholder="Select type" />
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
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select stage" />
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
                      <Input type="number" {...field} placeholder="0.00" />
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
                      <Input type="number" {...field} placeholder="0.00" />
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
                          id={`emp-add-${emp.id}`}
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
                        <Label htmlFor={`emp-add-${emp.id}`} className="text-xs font-normal cursor-pointer flex-1 flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{emp.full_name}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{emp.designation}</span>
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
