import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Users, 
  DollarSign, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Calendar, 
  Receipt,
  Mail,
  Phone,
  Briefcase,
  Clock,
  CalendarDays,
  Search,
  UserCheck,
  UserX,
  Sparkles
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Tables } from '@/integrations/supabase/types';

type Employee = Tables<'employees'>;

export default function Team() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  
  const [addOpen, setAddOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<(Employee & { profile?: { full_name: string | null; email: string | null; avatar_url: string | null } }) | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
  
  // Selected employee detail state
  const [detailEmployee, setDetailEmployee] = useState<(Employee & { profile?: { full_name: string | null; email: string | null; avatar_url: string | null } }) | null>(null);
  
  // Local search filter state
  const [searchQuery, setSearchQuery] = useState('');

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
        .select('user_id, full_name, email, avatar_url')
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

  // Apply real-time search query filtering
  const filteredEmployees = employees.filter(e => {
    const fullName = e.profile?.full_name?.toLowerCase() || '';
    const designation = e.designation?.toLowerCase() || '';
    const department = e.department?.toLowerCase() || '';
    const email = e.profile?.email?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();
    
    return fullName.includes(search) || 
           designation.includes(search) || 
           department.includes(search) || 
           email.includes(search);
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
            <Users className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600" />
          </div>
          <p className="text-sm font-semibold text-slate-500 animate-pulse">Assembling team portal...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-12">
        {/* Top Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <Users className="h-5 w-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Team</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Manage your high-performance team members, view profiles, and payroll structures.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button className="gradient-primary text-xs font-bold uppercase tracking-wider py-5 px-5 rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all" onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            )}
          </div>
        </div>

        {/* High-End KPI Overview Row */}
        {isAdmin && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* KPI Card 1: Team Members */}
            <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-3xl group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-6 translate-x-6"></div>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Team Members</p>
                    <div className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                      {employees.length}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[11px] font-bold text-slate-500">{activeEmployees.length} Active Members</span>
                    </div>
                  </div>
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-inner group-hover:scale-105 transition-transform duration-300">
                    <Users className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPI Card 2: Burn Rate */}
            <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-3xl group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -translate-y-6 translate-x-6"></div>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Monthly Burn Rate</p>
                    <div className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                      ৳{totalBurnRate.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
                      <span className="text-[11px] font-bold text-slate-500">Total Monthly Salary Burden</span>
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl shadow-inner group-hover:scale-105 transition-transform duration-300">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Real-time Search and Filter Panel */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search employee by name, designation, department, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-semibold pl-11 pr-4 py-3 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        {/* Grid List Section */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((employee) => (
            <Card key={employee.id} className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Left Column: Avatar Framework */}
                  <div className="relative cursor-pointer shrink-0" onClick={() => setDetailEmployee(employee)}>
                    <Avatar className="h-14 w-14 shadow-sm border border-slate-100 dark:border-slate-800 hover:scale-105 transition-transform duration-300">
                      <AvatarImage src={employee.profile?.avatar_url || ''} className="object-cover" />
                      <AvatarFallback className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold text-base">
                        {(employee.profile?.full_name || 'U')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${
                      employee.status === 'active' 
                        ? 'bg-emerald-500 animate-pulse' 
                        : employee.status === 'on_leave'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}></span>
                  </div>
                  
                  {/* Right Column: Key Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 
                        onClick={() => setDetailEmployee(employee)}
                        className="font-bold text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        {employee.profile?.full_name || 'Unknown User'}
                      </h3>
                      
                      {isAdmin && (
                        <div className="shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-650 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-xl"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem onClick={() => setEditEmployee(employee)} className="text-xs font-semibold">
                                <Edit className="h-4 w-4 mr-2 text-slate-400" />
                                Edit details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteEmployee(employee)}
                                className="text-destructive focus:text-destructive text-xs font-semibold"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{employee.designation}</p>
                    {employee.department && (
                      <span className="inline-block text-[9px] font-extrabold uppercase bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200/30 mt-1">
                        {employee.department}
                      </span>
                    )}
                    
                    {/* Compact Contact details */}
                    <div className="space-y-1 mt-3 border-t border-slate-100 dark:border-slate-800/20 pt-3 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">{employee.profile?.email || 'N/A'}</span>
                      </div>
                      {employee.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{employee.phone}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Bottom strip action bar */}
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/20">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {isAdmin ? `৳${Number(employee.base_salary).toLocaleString()}/mo` : 'Confidential'}
                      </span>
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setDetailEmployee(employee)}
                        className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 p-0 h-auto hover:bg-transparent"
                      >
                        All Details →
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredEmployees.length === 0 && (
            <Card className="bg-white/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40 col-span-full rounded-2xl">
              <CardContent className="py-16 text-center space-y-3">
                <Users className="h-12 w-12 mx-auto text-slate-400" />
                <p className="text-sm font-semibold text-slate-500">No team members matched your criteria.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={!!detailEmployee} onOpenChange={(open) => { if (!open) setDetailEmployee(null); }}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-2xl">
          {detailEmployee && (
            <div className="relative">
              {/* Invisible header for Radix UI accessibility compliance */}
              <div className="sr-only">
                <DialogHeader>
                  <DialogTitle>{detailEmployee.profile?.full_name || 'Employee Profile'}</DialogTitle>
                  <DialogDescription>Detailed overview and compensation structure for the employee</DialogDescription>
                </DialogHeader>
              </div>
              {/* Header Gradient */}
              <div className="h-32 bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-pink-500/20 dark:from-indigo-500/10 dark:to-pink-500/10 relative">
                {/* Floating Badges */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <Badge 
                    variant={detailEmployee.status === 'active' ? 'default' : 'secondary'}
                    className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-xl border ${
                      detailEmployee.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : detailEmployee.status === 'on_leave'
                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {detailEmployee.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {/* Avatar Frame */}
              <div className="absolute top-16 left-6">
                <div className="p-1 bg-white dark:bg-slate-900 rounded-full shadow-md inline-block">
                  <Avatar className="h-20 w-20 rounded-full">
                    <AvatarImage src={detailEmployee.profile?.avatar_url || ''} className="object-cover" />
                    <AvatarFallback className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-2xl font-black">
                      {(detailEmployee.profile?.full_name || 'U')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              {/* Details Content Container */}
              <div className="pt-10 px-6 pb-6 space-y-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                    {detailEmployee.profile?.full_name || 'Unknown User'}
                  </h2>
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">
                    {detailEmployee.designation}
                  </p>
                  {detailEmployee.department && (
                    <span className="inline-block text-[9px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md mt-1 border border-slate-200/30">
                      {detailEmployee.department}
                    </span>
                  )}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800/30 pt-5">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-indigo-500" />
                    Employment & Compensation Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800/30">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Salary Structure</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                        {isAdmin ? `৳${Number(detailEmployee.base_salary).toLocaleString()}/mo` : 'Confidential'}
                      </p>
                    </div>
                    
                    <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800/30">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Joined Date</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {detailEmployee.joining_date 
                          ? new Date(detailEmployee.joining_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                          : detailEmployee.created_at
                          ? new Date(detailEmployee.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                          : 'N/A'}
                      </p>
                    </div>

                    <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800/30 col-span-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Unique Workplace ID Reference</p>
                      <code className="text-xs text-slate-500 font-mono select-all block break-all pt-0.5">
                        {detailEmployee.user_id}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800/30 pt-5">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-emerald-500" />
                    Contact Channels
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs text-slate-650 dark:text-slate-300">
                      <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 shadow-sm shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <span className="font-semibold select-all break-all">{detailEmployee.profile?.email || 'No email attached'}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-650 dark:text-slate-300">
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 shadow-sm shrink-0">
                        <Phone className="h-4 w-4" />
                      </div>
                      <span className="font-bold select-all">{detailEmployee.phone || 'No phone contact provided'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="border-t border-slate-100 dark:border-slate-800/30 pt-5 flex justify-end gap-3">
                  <Button variant="outline" className="rounded-xl text-xs font-semibold px-4 py-2 border-slate-200 dark:border-slate-800" onClick={() => setDetailEmployee(null)}>
                    Close Profile
                  </Button>
                  {isAdmin && (
                    <Button 
                      className="rounded-xl gradient-primary text-xs font-semibold px-4 py-2 shadow-sm"
                      onClick={() => {
                        setDetailEmployee(null);
                        setEditEmployee(detailEmployee);
                      }}
                    >
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Employee Dialog */}
      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} />

      {/* Edit Employee Dialog */}
      <EditEmployeeDialog
        employee={editEmployee}
        onOpenChange={(open) => !open && setEditEmployee(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEmployee} onOpenChange={(open) => !open && setDeleteEmployee(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this employee? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEmployee && deleteMutation.mutate(deleteEmployee.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
