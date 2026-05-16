import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

type LeadCategory = 'study_abroad' | 'fashion' | 'real_estate' | 'healthcare' | 'technology' | 'education' | 'retail' | 'hospitality' | 'other';

const schema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  category: z.enum(['study_abroad', 'fashion', 'real_estate', 'healthcare', 'technology', 'education', 'retail', 'hospitality', 'other']).optional(),
  city: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddLeadDialog({ open, onOpenChange }: AddLeadDialogProps) {
  const queryClient = useQueryClient();
  const { sendNotification } = useNotifications();
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'other' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const insertData: {
        business_name: string;
        contact_person?: string;
        phone?: string;
        email?: string;
        category: LeadCategory;
        city?: string;
        status: 'new';
        source: string;
      } = {
        business_name: data.business_name,
        contact_person: data.contact_person || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        category: (data.category as LeadCategory) || 'other',
        city: data.city || undefined,
        status: 'new',
        source: 'manual',
      };

      const { error } = await supabase.from('leads').insert(insertData);
      if (error) throw error;
      
      // Notify all admins
      sendNotification({
        title: 'New Lead Added',
        message: `A new lead "${data.business_name}" has been added to the pipeline.`,
        type: 'success',
        actionLink: '/crm'
      });

      toast.success('Lead added successfully!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add lead');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Business Name *</Label>
            <Input {...register('business_name')} placeholder="Company name" />
            {errors.business_name && <p className="text-sm text-destructive mt-1">{errors.business_name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Contact Person</Label>
              <Input {...register('contact_person')} placeholder="John Doe" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input {...register('phone')} placeholder="+1234567890" />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input {...register('email')} type="email" placeholder="email@company.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select onValueChange={(v) => setValue('category', v as LeadCategory)} defaultValue="other">
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="study_abroad">Study Abroad</SelectItem>
                  <SelectItem value="fashion">Fashion</SelectItem>
                  <SelectItem value="real_estate">Real Estate</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="hospitality">Hospitality</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>City</Label>
              <Input {...register('city')} placeholder="City" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="gradient-primary">{isSubmitting ? 'Adding...' : 'Add Lead'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}