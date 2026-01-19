import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEmployeeDialog({ open, onOpenChange }: AddEmployeeDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    user_id: '',
    designation: '',
    department: '',
    phone: '',
    base_salary: '',
    status: 'active',
  });

  // Fetch users who don't have an employee record yet
  const { data: availableUsers = [] } = useQuery({
    queryKey: ['available-users-for-employee'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');
      if (profilesError) throw profilesError;

      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('user_id');
      if (employeesError) throw employeesError;

      const employeeUserIds = new Set(employees.map(e => e.user_id));
      return profiles.filter(p => !employeeUserIds.has(p.user_id));
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('employees').insert({
        user_id: formData.user_id,
        designation: formData.designation,
        department: formData.department || null,
        phone: formData.phone || null,
        base_salary: parseFloat(formData.base_salary) || 0,
        status: formData.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee added successfully');
      onOpenChange(false);
      setFormData({
        user_id: '',
        designation: '',
        department: '',
        phone: '',
        base_salary: '',
        status: 'active',
      });
    },
    onError: (error) => {
      toast.error('Failed to add employee: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id || !formData.designation) {
      toast.error('Please select a user and enter a designation');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>Add a new team member to your organization.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user">User *</Label>
            <Select
              value={formData.user_id}
              onValueChange={(value) => setFormData({ ...formData, user_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.full_name || user.email || 'Unknown User'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding...' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
