import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2,
  LogOut,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Briefcase,
  Edit2,
  Save,
  X,
  CalendarDays,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { LeaveApplicationDialog } from '@/components/team/LeaveApplicationDialog';
import type { Tables } from '@/integrations/supabase/types';

type Employee = Tables<'employees'>;
type PayrollLog = Tables<'payroll_log'>;
type Profile = Tables<'profiles'>;

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  unpaid: 'Unpaid Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  other: 'Other',
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'text-warning' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-success' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-destructive' },
  cancelled: { label: 'Cancelled', icon: X, color: 'text-muted-foreground' },
};

export default function EmployeePortal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role, signOut, loading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ full_name: '', phone: '' });
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== 'employee')) {
      navigate('/auth');
    }
  }, [user, role, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ['employee-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user,
  });

  const { data: employee } = useQuery({
    queryKey: ['employee-record', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Employee | null;
    },
    enabled: !!user,
  });

  const { data: payrollHistory = [] } = useQuery({
    queryKey: ['employee-payroll', employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_log')
        .select('*')
        .eq('employee_id', employee!.id)
        .order('payment_date', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as PayrollLog[];
    },
    enabled: !!employee?.id,
  });

  const { data: leaveApplications = [] } = useQuery({
    queryKey: ['leave-applications', employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('employee_id', employee!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  const cancelLeaveMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      const { error } = await supabase
        .from('leave_applications')
        .update({ status: 'cancelled' })
        .eq('id', leaveId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
      toast.success('Leave application cancelled');
    },
    onError: (error) => {
      toast.error('Failed to cancel leave: ' + error.message);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { full_name: string; phone: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-profile'] });
      toast.success('Profile updated successfully');
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error('Failed to update profile: ' + error.message);
    },
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleEdit = () => {
    setEditData({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateProfileMutation.mutate(editData);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const totalEarnings = payrollHistory.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 gradient-primary rounded-lg">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-lg">TechWisdom</span>
              <p className="text-xs text-muted-foreground">Employee Self-Service</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8 max-w-4xl">
        {/* Profile Header */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <Avatar className="h-24 w-24 text-2xl">
                <AvatarFallback className="gradient-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold">{profile?.full_name || 'Employee'}</h1>
                <p className="text-muted-foreground">{employee?.designation || 'Team Member'}</p>
                {employee?.department && (
                  <Badge variant="outline" className="mt-2">
                    {employee.department}
                  </Badge>
                )}
              </div>
              <Badge variant="default" className="text-sm">
                {employee?.status || 'Active'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal Information */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Personal Information
                </CardTitle>
                {!isEditing ? (
                  <Button variant="ghost" size="sm" onClick={handleEdit}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={updateProfileMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      value={editData.full_name}
                      onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={editData.phone}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{profile?.email || user?.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{profile?.phone || employee?.phone || 'Not set'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Joined:{' '}
                      {employee?.joining_date
                        ? format(new Date(employee.joining_date), 'MMM d, yyyy')
                        : 'N/A'}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Employment Details */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Employment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Designation</span>
                <span className="font-medium">{employee?.designation || 'N/A'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{employee?.department || 'N/A'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Salary</span>
                <span className="font-medium">
                  ${Number(employee?.base_salary || 0).toLocaleString()}/month
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={employee?.status === 'active' ? 'default' : 'secondary'}>
                  {employee?.status || 'Active'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Leave & Salary */}
        <Tabs defaultValue="leave" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leave" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Leave Applications
            </TabsTrigger>
            <TabsTrigger value="salary" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Salary History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leave">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      Leave Applications
                    </CardTitle>
                    <CardDescription>Your leave requests and history</CardDescription>
                  </div>
                  <Button onClick={() => setLeaveDialogOpen(true)} disabled={!employee}>
                    <Plus className="h-4 w-4 mr-2" />
                    Apply for Leave
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {leaveApplications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No leave applications yet. Apply for your first leave.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaveApplications.map((leave) => {
                      const days = differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
                      const statusConfig = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
                      const StatusIcon = statusConfig.icon;
                      return (
                        <div
                          key={leave.id}
                          className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
                              </p>
                              <Badge variant="secondary">{days} day{days > 1 ? 's' : ''}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d, yyyy')}
                            </p>
                            {leave.reason && (
                              <p className="text-xs text-muted-foreground mt-1">{leave.reason}</p>
                            )}
                            {leave.review_notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                Note: {leave.review_notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-1 ${statusConfig.color}`}>
                              <StatusIcon className="h-4 w-4" />
                              <span className="text-sm font-medium">{statusConfig.label}</span>
                            </div>
                            {leave.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => cancelLeaveMutation.mutate(leave.id)}
                                disabled={cancelLeaveMutation.isPending}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salary">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Salary History
                  </CardTitle>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total Earnings (Last 12 months)</p>
                    <p className="text-xl font-bold text-success">${totalEarnings.toLocaleString()}</p>
                  </div>
                </div>
                <CardDescription>Your recent salary payments</CardDescription>
              </CardHeader>
              <CardContent>
                {payrollHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No salary records found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payrollHistory.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {format(new Date(record.payment_date), 'MMMM yyyy')}
                          </p>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            {record.bonus && Number(record.bonus) > 0 && (
                              <span className="text-success">+${Number(record.bonus)} bonus</span>
                            )}
                            {record.deduction && Number(record.deduction) > 0 && (
                              <span className="text-destructive">-${Number(record.deduction)} deduction</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-success">
                            ${Number(record.amount_paid).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Leave Application Dialog */}
      {employee && (
        <LeaveApplicationDialog
          open={leaveDialogOpen}
          onOpenChange={setLeaveDialogOpen}
          employeeId={employee.id}
        />
      )}
    </div>
  );
}