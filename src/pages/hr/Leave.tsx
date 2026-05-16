import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LeaveManagement } from '@/components/team/LeaveManagement';
import { useAuth } from '@/hooks/useAuth';

export default function Leave() {
  const { role } = useAuth();
  
  if (role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">You do not have permission to view this page.</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground mt-1">Manage employee leave requests and balances.</p>
        </div>
        <LeaveManagement />
      </div>
    </DashboardLayout>
  );
}
