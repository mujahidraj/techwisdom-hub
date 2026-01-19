import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, Plus, Loader2, Receipt } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PayrollManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addPayrollOpen, setAddPayrollOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [payrollData, setPayrollData] = useState({
    amount_paid: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    bonus: '',
    deduction: '',
    notes: '',
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-payroll'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = data.map((e) => e.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data.map((employee) => ({
        ...employee,
        profile: profileMap.get(employee.user_id),
      }));
    },
  });

  const { data: payrollRecords = [], isLoading } = useQuery({
    queryKey: ['payroll-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_log')
        .select('*')
        .order('payment_date', { ascending: false })
        .limit(100);
      if (error) throw error;

      const employeeIds = [...new Set(data.map((p) => p.employee_id))];
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, user_id, designation')
        .in('id', employeeIds);

      const userIds = employeesData?.map((e) => e.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const employeeMap = new Map(employeesData?.map((e) => [e.id, e]) || []);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      return data.map((record) => {
        const employee = employeeMap.get(record.employee_id);
        const profile = employee ? profileMap.get(employee.user_id) : null;
        return {
          ...record,
          employee,
          profile,
        };
      });
    },
  });

  const createPayrollMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('payroll_log').insert({
        employee_id: selectedEmployee,
        amount_paid: parseFloat(payrollData.amount_paid),
        payment_date: payrollData.payment_date,
        bonus: payrollData.bonus ? parseFloat(payrollData.bonus) : 0,
        deduction: payrollData.deduction ? parseFloat(payrollData.deduction) : 0,
        notes: payrollData.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      toast.success('Payroll record added successfully');
      setAddPayrollOpen(false);
      setSelectedEmployee('');
      setPayrollData({
        amount_paid: '',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        bonus: '',
        deduction: '',
        notes: '',
      });
    },
    onError: (error) => {
      toast.error('Failed to add payroll record: ' + error.message);
    },
  });

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      setPayrollData((prev) => ({
        ...prev,
        amount_paid: employee.base_salary.toString(),
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }
    if (!payrollData.amount_paid || parseFloat(payrollData.amount_paid) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    createPayrollMutation.mutate();
  };

  // Calculate monthly stats
  const currentMonth = format(new Date(), 'yyyy-MM');
  const thisMonthPayroll = payrollRecords.filter(
    (r) => r.payment_date.startsWith(currentMonth)
  );
  const totalPaidThisMonth = thisMonthPayroll.reduce(
    (sum, r) => sum + Number(r.amount_paid),
    0
  );
  const totalBonuses = thisMonthPayroll.reduce(
    (sum, r) => sum + Number(r.bonus || 0),
    0
  );

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading payroll data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Paid This Month
                  </p>
                  <div className="text-2xl font-bold">
                    ${totalPaidThisMonth.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {thisMonthPayroll.length} payments
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Bonuses This Month
                  </p>
                  <div className="text-2xl font-bold text-success">
                    ${totalBonuses.toLocaleString()}
                  </div>
                </div>
                <Receipt className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Employees
                  </p>
                  <div className="text-2xl font-bold">{employees.length}</div>
                </div>
                <Button onClick={() => setAddPayrollOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payroll History */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Payroll History
            </CardTitle>
            <CardDescription>Recent salary payments and records</CardDescription>
          </CardHeader>
          <CardContent>
            {payrollRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payroll records found. Add your first payment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Bonus</TableHead>
                      <TableHead>Deduction</TableHead>
                      <TableHead>Net Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {record.profile?.full_name || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {record.employee?.designation}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.payment_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          ${Number(record.amount_paid).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {Number(record.bonus) > 0 ? (
                            <span className="text-success">
                              +${Number(record.bonus).toLocaleString()}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {Number(record.deduction) > 0 ? (
                            <span className="text-destructive">
                              -${Number(record.deduction).toLocaleString()}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            $
                            {(
                              Number(record.amount_paid) +
                              Number(record.bonus || 0) -
                              Number(record.deduction || 0)
                            ).toLocaleString()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Payroll Dialog */}
      <Dialog open={addPayrollOpen} onOpenChange={setAddPayrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payroll Record</DialogTitle>
            <DialogDescription>
              Record a salary payment for an employee.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={handleEmployeeSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.profile?.full_name || 'Unknown'} - {emp.designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={payrollData.amount_paid}
                  onChange={(e) =>
                    setPayrollData({ ...payrollData, amount_paid: e.target.value })
                  }
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Payment Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={payrollData.payment_date}
                  onChange={(e) =>
                    setPayrollData({ ...payrollData, payment_date: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bonus">Bonus</Label>
                <Input
                  id="bonus"
                  type="number"
                  step="0.01"
                  value={payrollData.bonus}
                  onChange={(e) =>
                    setPayrollData({ ...payrollData, bonus: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deduction">Deduction</Label>
                <Input
                  id="deduction"
                  type="number"
                  step="0.01"
                  value={payrollData.deduction}
                  onChange={(e) =>
                    setPayrollData({ ...payrollData, deduction: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={payrollData.notes}
                onChange={(e) =>
                  setPayrollData({ ...payrollData, notes: e.target.value })
                }
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddPayrollOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createPayrollMutation.isPending}>
                {createPayrollMutation.isPending ? 'Adding...' : 'Add Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
