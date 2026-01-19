import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, DollarSign, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AddEmployeeDialog } from '@/components/team/AddEmployeeDialog';
import { EditEmployeeDialog } from '@/components/team/EditEmployeeDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Tables } from '@/integrations/supabase/types';

type Employee = Tables<'employees'>;

export default function Team() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  
  const [addOpen, setAddOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<(Employee & { profile?: { full_name: string | null; email: string | null } }) | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch profiles for each employee
      const userIds = data.map(e => e.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return data.map(employee => ({
        ...employee,
        profile: profileMap.get(employee.user_id) || null,
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee removed successfully');
      setDeleteEmployee(null);
    },
    onError: (error) => {
      toast.error('Failed to delete employee: ' + error.message);
    },
  });

  const activeEmployees = employees.filter(e => e.status === 'active');
  const totalBurnRate = activeEmployees.reduce((sum, e) => sum + Number(e.base_salary), 0);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading team...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Team</h1>
            <p className="text-muted-foreground mt-1">Manage your team members and payroll.</p>
          </div>
          {isAdmin && (
            <Button className="gradient-primary" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>

        {isAdmin && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Team Members</p>
                    <div className="text-2xl font-bold">{employees.length}</div>
                    <p className="text-xs text-muted-foreground">{activeEmployees.length} active</p>
                  </div>
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Monthly Burn Rate</p>
                    <div className="text-2xl font-bold">${totalBurnRate.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Total monthly salaries</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-warning" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <Card key={employee.id} className="glass-card hover:shadow-medium transition-shadow group">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(employee.profile?.full_name || 'U')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">
                        {employee.profile?.full_name || 'Unknown User'}
                      </h3>
                      <Badge
                        variant={employee.status === 'active' ? 'default' : 'secondary'}
                        className={employee.status === 'active' ? 'bg-success' : ''}
                      >
                        {employee.status === 'active' ? 'Active' : employee.status === 'on_leave' ? 'On Leave' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{employee.designation}</p>
                    {employee.department && (
                      <p className="text-xs text-muted-foreground">{employee.department}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {employee.profile?.email || employee.phone}
                    </p>
                    {isAdmin && (
                      <p className="text-sm font-medium mt-2">
                        ${Number(employee.base_salary).toLocaleString()}/mo
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditEmployee(employee)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteEmployee(employee)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {employees.length === 0 && (
            <Card className="glass-card col-span-full">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No team members yet. Add your first employee.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Employee Dialog */}
      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} />

      {/* Edit Employee Dialog */}
      <EditEmployeeDialog
        employee={editEmployee}
        onOpenChange={(open) => !open && setEditEmployee(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEmployee} onOpenChange={(open) => !open && setDeleteEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this employee? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEmployee && deleteMutation.mutate(deleteEmployee.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
