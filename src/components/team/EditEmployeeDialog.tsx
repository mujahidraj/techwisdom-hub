import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Tables } from '@/integrations/supabase/types';

type Employee = Tables<'employees'>;

interface EditEmployeeDialogProps {
  employee: (Employee & { profile?: { full_name: string | null; email: string | null } }) | null;
  onOpenChange: (open: boolean) => void;
}

export function EditEmployeeDialog({ employee, onOpenChange }: EditEmployeeDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    designation: '',
    department: '',
    phone: '',
    base_salary: '',
    status: 'active',
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        designation: employee.designation,
        department: employee.department || '',
        phone: employee.phone || '',
        base_salary: employee.base_salary.toString(),
        status: employee.status,
      });
    }
  }, [employee]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!employee) return;
      const { error } = await supabase
        .from('employees')
        .update({
          designation: formData.designation,
          department: formData.department || null,
          phone: formData.phone || null,
          base_salary: parseFloat(formData.base_salary) || 0,
          status: formData.status,
        })
        .eq('id', employee.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to update employee: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.designation) {
      toast.error('Designation is required');
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <DialogDescription>
            Update details for {employee?.profile?.full_name || 'employee'}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="designation">Designation *</Label>
            <Input
              id="designation"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              placeholder="e.g., Senior Developer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="e.g., Engineering"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 234 567 890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salary">Base Salary</Label>
            <Input
              id="salary"
              type="number"
              value={formData.base_salary}
              onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
              placeholder="5000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
