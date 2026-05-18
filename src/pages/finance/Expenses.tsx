import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Receipt, Pencil, Trash2, Search, Calendar, Filter, RotateCcw, Coins, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AddExpenseDialog } from '@/components/finances/AddExpenseDialog';
import { EditExpenseDialog } from '@/components/finances/EditExpenseDialog';
import { formatCurrency } from '@/lib/currency';
import type { Tables } from '@/integrations/supabase/types';

type Expense = Tables<'expenses'>;

const CATEGORY_COLORS: Record<string, string> = {
  rent: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  server: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  software: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  marketing: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  salary: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  utilities: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  office_supplies: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  travel: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  other: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

export default function Expenses() {
  const navigate = useNavigate();
  const { role, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);

  // Client-side filtration states
  const [timeframe, setTimeframe] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      toast.error('Access denied. Only admins can view expenses.');
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

  const getCategoryBadgeClass = (category: string) => {
    return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.other;
  };

  // 100% Client-side filters
  const filteredExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date);
    const now = new Date();

    // Timeframe Filter
    if (timeframe === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      if (expenseDate < oneWeekAgo) return false;
    } else if (timeframe === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(now.getDate() - 30);
      if (expenseDate < oneMonthAgo) return false;
    } else if (timeframe === 'year') {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(now.getDate() - 365);
      if (expenseDate < oneYearAgo) return false;
    }

    // Category Filter
    if (selectedCategory !== 'all' && e.category.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }

    // Search Query Filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const matchTitle = e.title?.toLowerCase().includes(query);
      const matchDesc = e.description?.toLowerCase().includes(query) || false;
      if (!matchTitle && !matchDesc) return false;
    }

    return true;
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const filteredTotal = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const resetFilters = () => {
    setTimeframe('all');
    setSelectedCategory('all');
    setSearchQuery('');
    toast.info('Filters cleared successfully');
  };

  const isFilterActive = timeframe !== 'all' || selectedCategory !== 'all' || searchQuery !== '';

  if (authLoading || (role === 'admin' && expensesLoading)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="text-muted-foreground text-sm font-medium">Loading operational expenses...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <Shield className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Access Denied</h2>
          <p className="text-muted-foreground text-sm max-w-sm mt-1.5">You do not have administrative rights to view financial ledger transactions.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-16">
        {/* --- HEADER --- */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-2.5 tracking-tight text-slate-800 dark:text-slate-100">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                <Receipt className="h-6 w-6" />
              </div>
              Company Expenses
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">Review, filter, and audit operational spending logs across teams.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-xl bg-card border-border/60 shadow-sm flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-rose-500" />
              All Time: <span className="text-slate-800 dark:text-slate-100">{formatCurrency(totalExpenses)}</span>
            </Badge>
            <AddExpenseDialog />
          </div>
        </div>

        {/* --- DYNAMIC STATS ROW --- */}
        {isFilterActive && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <Card className="relative overflow-hidden bg-rose-500/5 border border-rose-500/15 rounded-2xl shadow-sm p-4 col-span-1">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest">Active Search Spend</p>
                <div className="text-xl font-black text-rose-700 dark:text-rose-400">{formatCurrency(filteredTotal)}</div>
                <p className="text-[10px] text-muted-foreground">Summed from {filteredExpenses.length} filtered transactions</p>
              </div>
            </Card>
            <Card className="relative overflow-hidden bg-card/60 dark:bg-slate-900/60 border border-border/40 rounded-2xl shadow-sm p-4 col-span-1">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Filters Status</p>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize text-[10px] px-2 py-0.5">{timeframe === 'all' ? 'All History' : `This ${timeframe}`}</Badge>
                  {selectedCategory !== 'all' && <Badge variant="secondary" className="capitalize text-[10px] px-2 py-0.5">{selectedCategory.replace('_', ' ')}</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground">Filters are currently refining results</p>
              </div>
            </Card>
            <div className="flex items-center">
              <Button onClick={resetFilters} variant="outline" size="sm" className="w-full md:w-auto rounded-xl border-dashed border-rose-500/30 text-rose-600 hover:text-rose-700 hover:bg-rose-500/5 flex items-center gap-1.5 py-5 px-6 font-semibold">
                <RotateCcw className="h-4 w-4" /> Reset Filtering
              </Button>
            </div>
          </div>
        )}

        {/* --- FILTERS WORKBENCH --- */}
        <Card className="bg-card/45 dark:bg-slate-900/45 backdrop-blur-md border border-border/40 rounded-2xl shadow-sm overflow-hidden p-5">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-12 items-end">
            {/* Search filter */}
            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Search className="h-3 w-3" /> Keyword Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, description..."
                  className="pl-9 rounded-xl border-border/60 bg-card"
                />
              </div>
            </div>

            {/* Timeframe filter */}
            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Time Period
              </Label>
              <div className="grid grid-cols-4 gap-1 bg-muted/65 p-1 rounded-xl border border-border/40">
                {(['all', 'week', 'month', 'year'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`py-1.5 px-1 text-[10px] sm:text-xs font-extrabold rounded-lg capitalize transition-all ${
                      timeframe === t 
                        ? 'bg-card text-slate-800 dark:text-slate-100 shadow-sm border border-border/30' 
                        : 'text-muted-foreground hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {t === 'all' ? 'All' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter */}
            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Filter className="h-3 w-3" /> Category Filter
              </Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="rounded-xl border-border/60 bg-card">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="salary">Salary & Payroll</SelectItem>
                  <SelectItem value="rent">Rent & Office Space</SelectItem>
                  <SelectItem value="software">Software & Subscriptions</SelectItem>
                  <SelectItem value="server">Server & Infrastructure</SelectItem>
                  <SelectItem value="marketing">Marketing & Adverts</SelectItem>
                  <SelectItem value="utilities">Utilities & Connections</SelectItem>
                  <SelectItem value="office_supplies">Office Supplies</SelectItem>
                  <SelectItem value="travel">Business Travel</SelectItem>
                  <SelectItem value="other">Other Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* --- MAIN EXPENSES LOG CARD --- */}
        <Card className="glass-card bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/45 flex flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Coins className="h-5 w-5 text-rose-500" />
                Operational Expense Log
              </CardTitle>
              <CardDescription className="text-xs">Audit transactions securely. Active results: {filteredExpenses.length}</CardDescription>
            </div>
            {isFilterActive && (
              <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 border-none font-bold rounded-lg px-2.5 py-1">
                Showing {filteredExpenses.length} of {expenses.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-4 px-3 sm:px-6">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-20 max-w-sm mx-auto">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">No Matching Expenses</h4>
                <p className="text-xs text-muted-foreground mt-1.5">No transactions were found matching the selected search query, timeframe, or category criteria.</p>
                {isFilterActive && (
                  <Button onClick={resetFilters} size="sm" variant="outline" className="mt-4 rounded-xl">
                    Clear Filters
                  </Button>
                )}
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
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} className="border-border/30 hover:bg-muted/10 transition-colors">
                        <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {format(new Date(expense.date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="max-w-[200px] sm:max-w-[280px]">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{expense.title}</p>
                            {expense.description && (
                              <p className="text-[10.5px] text-muted-foreground truncate" title={expense.description}>
                                {expense.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`border uppercase text-[9px] font-extrabold tracking-wider px-2 py-0.5 shadow-none ${getCategoryBadgeClass(expense.category)}`}>
                            {expense.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                          {formatCurrency(Number(expense.amount))}
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

        {/* --- EDIT EXPENSE DIALOG --- */}
        {editingExpense && (
          <EditExpenseDialog
            expense={editingExpense}
            open={!!editingExpense}
            onOpenChange={(open) => !open && setEditingExpense(null)}
          />
        )}

        {/* --- DELETE CONFIRMATION DIALOG --- */}
        <AlertDialog open={!!deleteExpense} onOpenChange={(open) => !open && setDeleteExpense(null)}>
          <AlertDialogContent className="rounded-2xl border-border/40 shadow-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Delete Expense Record?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete "{deleteExpense?.title}"? Doing so will void the audit trace and subtract {deleteExpense && formatCurrency(Number(deleteExpense.amount))} from all company aggregates.
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
      </div>
    </DashboardLayout>
  );
}
