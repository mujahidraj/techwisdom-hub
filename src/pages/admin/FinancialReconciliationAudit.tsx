import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, AlertTriangle, AlertCircle, Clock, FileWarning, TrendingUp } from 'lucide-react';
import { format, differenceInDays, isBefore } from 'date-fns';

export default function FinancialReconciliationAudit() {

  const { data, isLoading } = useQuery({
    queryKey: ['financial_reconciliation_audit'],
    queryFn: async () => {
      const [
        { data: invoices },
        { data: expenses }
      ] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('date', { ascending: false })
      ]);

      return {
        invoices: invoices || [],
        expenses: expenses || []
      };
    }
  });

  const stats = useMemo(() => {
    if (!data) return null;

    // 1. Receivables Summary
    const paidInvoices = data.invoices.filter(i => i.status === 'paid');
    const totalPaidAmount = paidInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

    // 2. Aging / Overdue Receivables (Leaks)
    const today = new Date();
    const overdueInvoices = data.invoices
      .filter(i => i.status !== 'paid' && i.due_date && isBefore(new Date(i.due_date), today))
      .map(i => ({
        ...i,
        daysOverdue: differenceInDays(today, new Date(i.due_date))
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
    
    const totalOverdueAmount = overdueInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

    // 3. Duplicate Expense Detection (Same Amount & Category within 3 Days)
    const possibleDuplicates: any[] = [];
    const expensesCopy = [...data.expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    for (let i = 0; i < expensesCopy.length; i++) {
      for (let j = i + 1; j < expensesCopy.length; j++) {
        const e1 = expensesCopy[i];
        const e2 = expensesCopy[j];
        
        // Don't check identical rows
        if (e1.id === e2.id) continue;
        
        // Exact same amount
        if (Number(e1.amount) === Number(e2.amount)) {
          const daysDiff = Math.abs(differenceInDays(new Date(e1.date), new Date(e2.date)));
          
          // Same category and within 3 days
          if (daysDiff <= 3 && e1.category === e2.category) {
            // Check if we haven't already flagged it
            if (!possibleDuplicates.some(d => d.id === e1.id || d.id === e2.id)) {
              possibleDuplicates.push({
                original: e1,
                duplicateOf: e2,
                reason: `Identical $${e1.amount} charge under '${e1.category}' within ${daysDiff} day(s)`
              });
            }
          }
        }
        
        // Stop checking if the dates are too far apart (since we sorted by date)
        if (Math.abs(differenceInDays(new Date(e1.date), new Date(e2.date))) > 14) {
          break; 
        }
      }
    }

    // 4. Unusually High Cost Detection (Anomalies)
    const anomalies: any[] = [];
    if (data.expenses.length > 0) {
      // Find average expense amount
      const avgExpense = data.expenses.reduce((sum, e) => sum + Number(e.amount), 0) / data.expenses.length;
      
      // Standard deviation approximation (simplified for speed)
      // Flag anything that is 3x the average cost of a normal expense
      const anomalyThreshold = avgExpense * 3;
      
      data.expenses.forEach(e => {
        if (Number(e.amount) > anomalyThreshold && Number(e.amount) > 100) {
          anomalies.push({
            ...e,
            threshold: Math.round(anomalyThreshold),
            ratio: (Number(e.amount) / avgExpense).toFixed(1)
          });
        }
      });
    }

    return {
      totalPaidAmount,
      overdueInvoices,
      totalOverdueAmount,
      possibleDuplicates,
      anomalies: anomalies.sort((a,b) => Number(b.amount) - Number(a.amount))
    };
  }, [data]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileWarning className="h-8 w-8 text-warning" />
              Financial Reconciliation Audit
            </h1>
            <p className="text-muted-foreground mt-1">Deep ledger analysis for anomalies, duplicate expenses, and financial leaks.</p>
          </div>
        </div>

        {isLoading || !stats ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-success" /> Total Revenue Collected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">${stats.totalPaidAmount.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Sum of all paid invoices</p>
                </CardContent>
              </Card>

              <Card className="glass-card border-l-4 border-l-destructive">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" /> Critical Outstanding Debt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">${stats.totalOverdueAmount.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">From {stats.overdueInvoices.length} overdue invoices</p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-warning" /> Duplicate Suspicions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.possibleDuplicates.length} Hits</div>
                  <p className="text-xs text-muted-foreground mt-1">Algorithm flagged double-charges</p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-500" /> Expense Anomalies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.anomalies.length} Flagged</div>
                  <p className="text-xs text-muted-foreground mt-1">Unusually high operational costs</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* DUPLICATE ALERTS */}
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2 text-warning">
                  <AlertCircle className="h-5 w-5" /> AI Duplicate Expense Detection
                </h2>
                {stats.possibleDuplicates.length === 0 ? (
                  <Card className="bg-success/5 border-success/20">
                    <CardContent className="p-6 text-center text-success flex flex-col items-center">
                      <DollarSign className="h-8 w-8 mb-2 opacity-50" />
                      <p className="font-medium">Ledger is clean.</p>
                      <p className="text-sm opacity-80 mt-1">No duplicate transactions detected.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {stats.possibleDuplicates.map((dup, i) => (
                      <Card key={i} className="bg-warning/5 border-warning/30">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg">{dup.original.title}</h3>
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/50">
                              Suspected Duplicate
                            </Badge>
                          </div>
                          <p className="text-sm font-mono bg-background/50 p-2 rounded mb-2 text-muted-foreground">
                            {dup.reason}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Logged: {format(new Date(dup.original.date), 'MMM dd, yyyy')}</span>
                            <span>Matched against: {format(new Date(dup.duplicateOf.date), 'MMM dd, yyyy')}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              {/* ANOMALY ALERTS */}
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2 text-orange-500">
                  <TrendingUp className="h-5 w-5" /> Cost Anomalies (Outliers)
                </h2>
                {stats.anomalies.length === 0 ? (
                  <Card className="bg-success/5 border-success/20">
                    <CardContent className="p-6 text-center text-success flex flex-col items-center">
                      <TrendingUp className="h-8 w-8 mb-2 opacity-50" />
                      <p className="font-medium">Expenses are stable.</p>
                      <p className="text-sm opacity-80 mt-1">No severe cost outliers detected this period.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {stats.anomalies.slice(0, 5).map((anomaly, i) => (
                      <Card key={i} className="border-orange-500/30 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
                        <CardContent className="p-4 pl-5">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold">{anomaly.title}</h3>
                            <span className="text-lg font-black text-orange-500">${Number(anomaly.amount).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Category: {anomaly.category} | Date: {format(new Date(anomaly.date), 'MMM dd, yyyy')}
                          </p>
                          <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-none">
                            {anomaly.ratio}x higher than standard company expense
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* AGING RECEIVABLES */}
            <section className="pt-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Aging Receivables (Unpaid Debt)
              </h2>
              {stats.overdueInvoices.length === 0 ? (
                <Card className="bg-success/5 border-success/20">
                  <CardContent className="p-6 text-center text-success">
                    <p className="font-medium">No overdue invoices.</p>
                    <p className="text-sm opacity-80 mt-1">All clients are paying on time.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass-card overflow-hidden border-destructive/20">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                        <tr>
                          <th className="px-6 py-4 font-medium">Invoice Number</th>
                          <th className="px-6 py-4 font-medium">Client</th>
                          <th className="px-6 py-4 font-medium">Amount Due</th>
                          <th className="px-6 py-4 font-medium">Overdue By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {stats.overdueInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-4 font-mono font-medium">
                              {inv.invoice_number}
                            </td>
                            <td className="px-6 py-4 font-medium">
                              {inv.client_name || 'Unknown Client'}
                            </td>
                            <td className="px-6 py-4 font-bold text-destructive">
                              ${Number(inv.total_amount).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant="destructive" className="bg-destructive/10 text-destructive border-none">
                                {inv.daysOverdue} Days Late
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </section>

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
