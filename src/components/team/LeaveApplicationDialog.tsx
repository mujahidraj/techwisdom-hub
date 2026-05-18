import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, FileText, Sparkles, Send } from 'lucide-react';

interface LeaveApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
  { value: 'other', label: 'Other' },
];

export function LeaveApplicationDialog({ open, onOpenChange, employeeId }: LeaveApplicationDialogProps) {
  const queryClient = useQueryClient();
  const { sendNotification } = useNotifications();
  const [formData, setFormData] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('leave_applications').insert({
        employee_id: employeeId,
        leave_type: data.leave_type as 'annual' | 'sick' | 'personal' | 'unpaid' | 'maternity' | 'paternity' | 'other',
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
      sendNotification({
        title: 'New Leave Application',
        message: `An employee has submitted a new leave application for ${formData.leave_type}.`,
        type: 'info',
        actionLink: `/hr/leave`
      });
      toast.success('Leave application submitted successfully');
      onOpenChange(false);
      setFormData({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
    },
    onError: (error) => {
      toast.error('Failed to submit leave application: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.start_date || !formData.end_date) {
      toast.error('Please select start and end dates');
      return;
    }
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      toast.error('End date must be after start date');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-2xl">
        <DialogHeader className="p-6 pb-0 relative">
          {/* Subtle Background Accent Glow */}
          <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl">
              <CalendarDays className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              Apply for Leave
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 pl-1">
            Submit a leave request for administrative approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Leave Type Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="leave_type" className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Leave Type
            </Label>
            <Select
              value={formData.leave_type}
              onValueChange={(value) => setFormData({ ...formData, leave_type: value })}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {LEAVE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-xs font-semibold">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Picker Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start_date" className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Start Date
              </Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
                className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="end_date" className="text-xs font-bold text-slate-500 dark:text-slate-400">
                End Date
              </Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
                className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Reason Textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <FileText className="h-3 w-3 text-slate-400" />
              Reason (Optional)
            </Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Provide a brief explanation for your leave application..."
              rows={3}
              className="rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold resize-none"
            />
          </div>

          {/* Modal Actions */}
          <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 border-t border-slate-100 dark:border-slate-800/30">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-bold px-5 h-11 border-slate-200 dark:border-slate-800"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="rounded-xl text-xs font-bold px-5 h-11 gradient-primary shadow-sm shadow-indigo-500/10"
            >
              {createMutation.isPending ? (
                'Submitting...'
              ) : (
                <>
                  Submit Application
                  <Send className="h-3.5 w-3.5 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
