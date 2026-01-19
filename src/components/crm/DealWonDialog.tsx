import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PartyPopper } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

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

const schema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  project_type: z.string().min(1, 'Project type is required'),
  total_budget: z.string().min(1, 'Budget is required'),
  deadline: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface DealWonDialogProps {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DealWonDialog({ lead, onOpenChange, onSuccess }: DealWonDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_name: lead?.business_name ? `${lead.business_name} Project` : '',
      project_type: '',
      total_budget: '',
      deadline: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('active_projects').insert({
        client_name: lead!.business_name,
        project_name: data.project_name,
        project_type: data.project_type,
        total_budget: parseFloat(data.total_budget),
        deadline: data.deadline || null,
        lead_id: lead!.id,
        created_by: userData.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('🎉 Project created successfully!');
      form.reset();
      onSuccess();
    },
    onError: (error) => {
      toast.error('Failed to create project: ' + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={!!lead} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <PartyPopper className="h-6 w-6 text-green-600" />
          </div>
          <DialogTitle className="text-xl">Congratulations! 🎉</DialogTitle>
          <DialogDescription>
            You've won the deal with <strong>{lead?.business_name}</strong>! Let's onboard this
            client by creating a project.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="project_name"
              render={({ field }) => (
                <FormItem>
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
              name="project_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project type" />
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
              name="total_budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Budget ($) *</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} placeholder="Enter budget" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deadline</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Skip for Now
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="gradient-primary">
                {mutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
