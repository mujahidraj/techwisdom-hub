import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'active_projects'>;

const projectTypes = [
  'website',
  'mobile_app',
  'web_app',
  'seo',
  'social_media',
  'branding',
  'consulting',
  'other',
];

const stages = [
  'discovery',
  'requirement',
  'strategy',
  'design',
  'development',
  'qa',
  'deployment',
  'maintenance',
];

const statuses = ['active', 'completed', 'on_hold', 'cancelled'];

const schema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  client_name: z.string().min(1, 'Client name is required'),
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

interface EditProjectDialogProps {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
}

export function EditProjectDialog({ project, onOpenChange }: EditProjectDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_name: '',
      client_name: '',
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
            <div className="grid grid-cols-2 gap-4">
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
                  <FormItem className="col-span-2">
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
                        {projectTypes.map((type) => (
                          <SelectItem key={type} value={type} className="capitalize">
                            {type.replace('_', ' ')}
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
                        {stages.map((stage) => (
                          <SelectItem key={stage} value={stage} className="capitalize">
                            {stage.replace('_', ' ')}
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
                    <FormLabel>Total Budget ($) *</FormLabel>
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
                    <FormLabel>Paid Amount ($)</FormLabel>
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
