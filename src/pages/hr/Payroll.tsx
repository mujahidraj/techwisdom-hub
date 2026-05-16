import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PayrollManagement } from '@/components/team/PayrollManagement';
import { useAuth } from '@/hooks/useAuth';

export default function Payroll() {
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
          <h1 className="text-2xl sm:text-3xl font-bold">Payroll Management</h1>
          <p className="text-muted-foreground mt-1">Process employee salaries and view payroll history.</p>
        </div>
        <PayrollManagement />
      </div>
    </DashboardLayout>
  );
}
