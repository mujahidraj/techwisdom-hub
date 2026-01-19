import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { TrendingUp, TrendingDown, DollarSign, Receipt, PiggyBank, Pencil, Trash2, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AddExpenseDialog } from '@/components/finances/AddExpenseDialog';
import { EditExpenseDialog } from '@/components/finances/EditExpenseDialog';
import { formatCurrency } from '@/lib/currency';
import type { Tables } from '@/integrations/supabase/types';

type Expense = Tables<'expenses'>;

const CATEGORY_COLORS: Record<string, string> = {
  rent: 'hsl(217, 91%, 60%)',
  server: 'hsl(271, 81%, 56%)',
  software: 'hsl(142, 71%, 45%)',
  marketing: 'hsl(38, 92%, 50%)',
  salary: 'hsl(0, 84%, 60%)',
  utilities: 'hsl(199, 89%, 48%)',
  office_supplies: 'hsl(262, 83%, 58%)',
  travel: 'hsl(25, 95%, 53%)',
  other: 'hsl(215, 14%, 34%)',
};

export default function Finances() {
  const navigate = useNavigate();
  const { role, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      toast.error('Access denied. Only admins can view finances.');
      navigate('/dashboard');
    }
  }, [role, authLoading, navigate]);

  // Fetch all expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
    enabled: role === 'admin',
  });

  // Fetch projects for revenue
  const { data: projects = [] } = useQuery({
    queryKey: ['finance-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_projects')
        .select('id, total_budget, paid_amount, project_type, start_date');
      if (error) throw error;
      return data;
    },
    enabled: role === 'admin',
  });

  // Fetch payroll for costs
  const { data: payroll = [] } = useQuery({
    queryKey: ['finance-payroll'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_log')
        .select('amount_paid, payment_date');
      if (error) throw error;
      return data;
    },
    enabled: role === 'admin',
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-expenses'] });
      toast.success('Expense deleted successfully');
      setDeleteExpense(null);
    },
    onError: (error) => {
      toast.error('Failed to delete expense: ' + error.message);
    },
  });

  // Show loading or access denied
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Shield className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only administrators can access financial data.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Calculate totals
  const totalRevenue = projects.reduce((sum, p) => sum + Number(p.total_budget || 0), 0);
  const totalPaid = projects.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalPayroll = payroll.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  const totalCosts = totalExpenses + totalPayroll;
  const netProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  // Generate monthly data for chart (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const monthRevenue = projects
      .filter(p => {
        const startDate = new Date(p.start_date);
        return startDate >= monthStart && startDate <= monthEnd;
      })
      .reduce((sum, p) => sum + Number(p.total_budget || 0), 0);

    const monthExpenses = expenses
      .filter(e => {
        const expDate = new Date(e.date);
        return expDate >= monthStart && expDate <= monthEnd;
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return {
      month: format(date, 'MMM'),
      revenue: monthRevenue,
      expenses: monthExpenses,
    };
  });

  // Revenue by project type
  const revenueByType = projects.reduce((acc, p) => {
    const type = p.project_type || 'Other';
    acc[type] = (acc[type] || 0) + Number(p.total_budget || 0);
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(revenueByType).map(([name, value], index) => ({
    name,
    value,
    color: Object.values(CATEGORY_COLORS)[index % Object.values(CATEGORY_COLORS).length],
  }));

  // Expenses by category
  const expensesByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const expensePieData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value,
    color: CATEGORY_COLORS[name] || CATEGORY_COLORS.other,
  }));

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'salary': return 'bg-red-100 text-red-800';
      case 'rent': return 'bg-blue-100 text-blue-800';
      case 'software': return 'bg-green-100 text-green-800';
      case 'server': return 'bg-purple-100 text-purple-800';
      case 'marketing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Financial Dashboard</h1>
            <p className="text-muted-foreground mt-1">Track revenue, expenses, and profitability.</p>
          </div>
          <AddExpenseDialog />
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-success flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" /> {formatCurrency(totalPaid)} collected
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {expenses.length} transactions
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Payroll Costs</CardTitle>
              <TrendingDown className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPayroll)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {payroll.length} payments
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <PiggyBank className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(netProfit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{profitMargin}% profit margin</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Revenue vs Expenses</CardTitle>
              <CardDescription>Last 6 months comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="revenue" fill="hsl(217, 91%, 60%)" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="hsl(0, 84%, 60%)" name="Expenses" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Revenue by Project Type</CardTitle>
              <CardDescription>Distribution of income sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No project data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expenses by Category Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
            <CardDescription>Breakdown of your spending</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {expensePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expensePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No expense data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expenses Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent Expenses</CardTitle>
            <CardDescription>Manage and track all expenses</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No expenses recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{expense.title}</p>
                            {expense.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {expense.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryBadgeColor(expense.category)}>
                            {expense.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingExpense(expense)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteExpense(expense)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Edit Dialog */}
      <EditExpenseDialog
        expense={editingExpense}
        open={!!editingExpense}
        onOpenChange={(open) => !open && setEditingExpense(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteExpense} onOpenChange={(open) => !open && setDeleteExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteExpense?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpense && deleteMutation.mutate(deleteExpense.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}