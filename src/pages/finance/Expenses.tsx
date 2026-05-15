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
import { Receipt, Pencil, Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AddExpenseDialog } from '@/components/finances/AddExpenseDialog';
import { EditExpenseDialog } from '@/components/finances/EditExpenseDialog';
import { formatCurrency } from '@/lib/currency';
import type { Tables } from '@/integrations/supabase/types';

type Expense = Tables<'expenses'>;

const CATEGORY_COLORS: Record<string, string> = {
  rent: 'bg-blue-500/10 text-blue-500',
  server: 'bg-purple-500/10 text-purple-500',
  software: 'bg-green-500/10 text-green-500',
  marketing: 'bg-yellow-500/10 text-yellow-500',
  salary: 'bg-red-500/10 text-red-500',
  utilities: 'bg-cyan-500/10 text-cyan-500',
  office_supplies: 'bg-indigo-500/10 text-indigo-500',
  travel: 'bg-orange-500/10 text-orange-500',
  other: 'bg-gray-500/10 text-gray-500',
};

export default function Expenses() {
  const navigate = useNavigate();
  const { role, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);

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

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  if (authLoading || (role === 'admin' && expensesLoading)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading expenses...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Company Expenses</h1>
            <p className="text-muted-foreground mt-1">Track and manage all operational expenses.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-lg px-4 py-1">
              Total: {formatCurrency(totalExpenses)}
            </Badge>
            <AddExpenseDialog />
          </div>
        </div>

        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              All Expenses
            </CardTitle>
            <CardDescription>A complete log of all company spending</CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                <p>No expenses recorded yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add your first expense to get started.</p>
              </div>
            ) : (
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(expense.date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{expense.title}</p>
                            {expense.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {expense.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize ${getCategoryBadgeClass(expense.category)} border-0`}>
                            {expense.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(expense.amount))}
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
                              onClick={() => setDeleteExpense(expense)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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

        {/* Dialogs */}
        {editingExpense && (
          <EditExpenseDialog
            expense={editingExpense}
            open={!!editingExpense}
            onOpenChange={(open) => !open && setEditingExpense(null)}
          />
        )}

        <AlertDialog open={!!deleteExpense} onOpenChange={(open) => !open && setDeleteExpense(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the expense record for "{deleteExpense?.title}" ({deleteExpense && formatCurrency(Number(deleteExpense.amount))}).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteExpense && deleteMutation.mutate(deleteExpense.id)}
              >
                Delete Expense
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
