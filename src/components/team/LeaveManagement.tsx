import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useState } from 'react';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  unpaid: 'Unpaid Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  other: 'Other',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
};

export function LeaveManagement() {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [reviewingLeave, setReviewingLeave] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const { data: leaveApplications = [], isLoading } = useQuery({
    queryKey: ['admin-leave-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch employee info
      const employeeIds = [...new Set(data.map((l) => l.employee_id))];
      const { data: employees } = await supabase
        .from('employees')
        .select('id, user_id, designation, department')
        .in('id', employeeIds);

      const userIds = employees?.map((e) => e.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const employeeMap = new Map(employees?.map((e) => [e.id, e]) || []);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data.map((leave) => {
        const employee = employeeMap.get(leave.employee_id);
        const profile = employee ? profileMap.get(employee.user_id) : null;
        return {
          ...leave,
          employee,
          profile,
        };
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: 'approved' | 'rejected'; notes: string }) => {
      const { error } = await supabase
        .from('leave_applications')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-leave-applications'] });
      
      // Notify the employee
      const leave = leaveApplications.find(l => l.id === variables.id);
      if (leave && leave.employee?.user_id) {
        sendNotification({
          userId: leave.employee.user_id,
          title: `Leave Application ${variables.status === 'approved' ? 'Approved' : 'Rejected'}`,
          message: `Your leave application for ${LEAVE_TYPE_LABELS[leave.leave_type]} has been ${variables.status}.`,
          type: variables.status === 'approved' ? 'success' : 'error',
          actionLink: `/employee-portal`
        });
      }

      toast.success(`Leave application ${variables.status}`);
      setReviewingLeave(null);
      setReviewNotes('');
    },
    onError: (error) => {
      toast.error('Failed to review application: ' + error.message);
    },
  });

  const handleReview = (status: 'approved' | 'rejected') => {
    if (!reviewingLeave) return;
    reviewMutation.mutate({
      id: reviewingLeave.id,
      status,
      notes: reviewNotes,
    });
  };

  const pendingCount = leaveApplications.filter((l) => l.status === 'pending').length;

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading leave applications...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Leave Applications
              </CardTitle>
              <CardDescription>Manage employee leave requests</CardDescription>
            </div>
            {pendingCount > 0 && (
              <Badge variant="outline" className="text-warning border-warning">
                {pendingCount} Pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {leaveApplications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No leave applications found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveApplications.map((leave) => {
                    const days = differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
                    const statusConfig = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
                    return (
                      <TableRow key={leave.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{leave.profile?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">
                              {leave.employee?.designation}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{format(new Date(leave.start_date), 'MMM d, yyyy')}</p>
                            <p className="text-muted-foreground">to {format(new Date(leave.end_date), 'MMM d, yyyy')}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{days} day{days > 1 ? 's' : ''}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {leave.status === 'pending' ? (
                            <Button size="sm" variant="outline" onClick={() => setReviewingLeave(leave)}>
                              Review
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {leave.reviewed_at && format(new Date(leave.reviewed_at), 'MMM d')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewingLeave} onOpenChange={(open) => !open && setReviewingLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Leave Application</DialogTitle>
            <DialogDescription>
              {reviewingLeave?.profile?.full_name} has requested{' '}
              {LEAVE_TYPE_LABELS[reviewingLeave?.leave_type] || reviewingLeave?.leave_type}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration:</span>
                <span>
                  {reviewingLeave?.start_date && format(new Date(reviewingLeave.start_date), 'MMM d, yyyy')} -{' '}
                  {reviewingLeave?.end_date && format(new Date(reviewingLeave.end_date), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Days:</span>
                <span>
                  {reviewingLeave && differenceInDays(new Date(reviewingLeave.end_date), new Date(reviewingLeave.start_date)) + 1}
                </span>
              </div>
              {reviewingLeave?.reason && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Reason:</p>
                  <p className="text-sm">{reviewingLeave.reason}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Review Notes (Optional)</label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes for this decision..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="destructive"
              onClick={() => handleReview('rejected')}
              disabled={reviewMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={() => handleReview('approved')}
              disabled={reviewMutation.isPending}
              className="bg-success hover:bg-success/90"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
