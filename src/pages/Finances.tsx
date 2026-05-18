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
      case 'salary': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'rent': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'software': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'server': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
      case 'marketing': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-10">
        {/* --- HEADER --- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-2.5 tracking-tight text-slate-800 dark:text-slate-100">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <PiggyBank className="h-6 w-6" />
              </div>
              Financial Dashboard
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">Track revenue, expenses, payroll costs, and platform profitability securely.</p>
          </div>
          <div className="shrink-0">
            <AddExpenseDialog />
          </div>
        </div>

        {/* --- KPI CARDS ROW --- */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 hover:border-primary/25 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm p-4 col-span-1">
            <CardContent className="p-0 flex items-center justify-between">
              <div className="space-y-1 truncate">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Total Revenue</p>
                <div className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(totalRevenue)}</div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 pt-0.5">
                  <TrendingUp className="h-3 w-3 inline" /> {formatCurrency(totalPaid)} collected
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-primary/10 text-primary shrink-0 ml-2">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 hover:border-primary/25 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm p-4 col-span-1">
            <CardContent className="p-0 flex items-center justify-between">
              <div className="space-y-1 truncate">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Total Expenses</p>
                <div className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(totalExpenses)}</div>
                <p className="text-[10px] text-muted-foreground font-medium pt-0.5">{expenses.length} transactions</p>
              </div>
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 shrink-0 ml-2">
                <Receipt className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 hover:border-primary/25 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm p-4 col-span-1">
            <CardContent className="p-0 flex items-center justify-between">
              <div className="space-y-1 truncate">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Payroll Costs</p>
                <div className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(totalPayroll)}</div>
                <p className="text-[10px] text-muted-foreground font-medium pt-0.5">{payroll.length} payments log</p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 shrink-0 ml-2">
                <TrendingDown className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className={`relative overflow-hidden bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border rounded-2xl hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm p-4 col-span-1 ${netProfit >= 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
            <CardContent className="p-0 flex items-center justify-between">
              <div className="space-y-1 truncate">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Net Profit</p>
                <div className={`text-xl md:text-2xl font-extrabold ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatCurrency(netProfit)}
                </div>
                <p className="text-[10px] text-slate-500 font-bold pt-0.5">{profitMargin}% margin</p>
              </div>
              <div className={`p-3 rounded-2xl shrink-0 ml-2 ${netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}>
                <PiggyBank className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- ROW 1: CHARTS (Bar Chart & Project Type Pie Chart) --- */}
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
          <Card className="glass-card bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/45">
              <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Revenue vs Expenses</CardTitle>
              <CardDescription className="text-xs">Last 6 months comparison overview.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="month" fontSize={11} stroke="rgba(156, 163, 175, 0.8)" />
                  <YAxis fontSize={11} stroke="rgba(156, 163, 175, 0.8)" tickFormatter={(val) => `৳${(val / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Value']}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid rgba(0, 0, 0, 0.05)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }} 
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="hsl(var(--destructive))" name="Expenses" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/45">
              <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Revenue by Project Type</CardTitle>
              <CardDescription className="text-xs">Distribution of all active client projects income.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] pt-4 flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="48%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Budget']}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid rgba(0, 0, 0, 0.05)',
                        borderRadius: '12px'
                      }} 
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                  No project budget distributions loaded
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- ROW 2: EXPENSES DISTRIBUTION & TRANSACTIONS TABLE --- */}
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
          {/* CATEGORY SPENDING PIE CHART */}
          <Card className="glass-card bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 rounded-2xl shadow-sm overflow-hidden lg:col-span-1">
            <CardHeader className="pb-3 border-b border-border/45">
              <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Expenses by Category</CardTitle>
              <CardDescription className="text-xs">Breakdown of operational spend.</CardDescription>
            </CardHeader>
            <CardContent className="h-[290px] pt-4 flex items-center justify-center">
              {expensePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensePieData}
                      cx="50%"
                      cy="48%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {expensePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Expense']}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid rgba(0, 0, 0, 0.05)',
                        borderRadius: '12px'
                      }} 
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                  No expense records reported
                </div>
              )}
            </CardContent>
          </Card>

          {/* RECENT EXPENSES LIST TABLE */}
          <Card className="glass-card bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 rounded-2xl shadow-sm overflow-hidden lg:col-span-2">
            <CardHeader className="pb-3 border-b border-border/45 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Recent Expenses</CardTitle>
                <CardDescription className="text-xs">Manage and audit company transactional costs.</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none shadow-none font-bold rounded-lg">{expenses.length}</Badge>
            </CardHeader>
            <CardContent className="pt-4 px-3 sm:px-6">
              {expensesLoading ? (
                <div className="text-center py-16 text-xs text-muted-foreground">Loading transactional data...</div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground max-w-sm mx-auto">
                  <Receipt className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Expenses Logged</h4>
                  <p className="text-xs text-muted-foreground mt-1">Get started by creating your first company spending record.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/45 bg-card/35">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-border/40">
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider py-3">Date</TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider py-3">Details</TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider py-3">Category</TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider py-3 text-right">Amount</TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider py-3 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id} className="border-border/30 hover:bg-muted/10 transition-colors">
                          <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {format(new Date(expense.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="max-w-[180px] sm:max-w-[240px]">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{expense.title}</p>
                              {expense.description && (
                                <p className="text-[10px] text-muted-foreground truncate" title={expense.description}>
                                  {expense.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`border uppercase text-[9px] font-extrabold tracking-wider px-2 py-0.5 shadow-none ${getCategoryBadgeColor(expense.category)}`}>
                              {expense.category.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                            {formatCurrency(expense.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-muted"
                                onClick={() => setEditingExpense(expense)}
                              >
                                <Pencil className="h-3.5 w-3.5 text-slate-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                onClick={() => setDeleteExpense(expense)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
      </div>

      {/* --- EDIT EXPENSE DIALOG --- */}
      <EditExpenseDialog
        expense={editingExpense}
        open={!!editingExpense}
        onOpenChange={(open) => !open && setEditingExpense(null)}
      />

      {/* --- DELETE CONFIRMATION DIALOG --- */}
      <AlertDialog open={!!deleteExpense} onOpenChange={(open) => !open && setDeleteExpense(null)}>
        <AlertDialogContent className="rounded-2xl border-border/40 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Delete Expense Record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{deleteExpense?.title}"? Doing so will void the audit trace and subtract this transaction from all company financial aggregates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-border/60">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpense && deleteMutation.mutate(deleteExpense.id)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}