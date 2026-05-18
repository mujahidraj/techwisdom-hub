import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  DollarSign,
  AlertTriangle,
  AlertCircle,
  Clock,
  FileWarning,
  TrendingUp,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  TrendingDown,
  ArrowUpRight
} from 'lucide-react';
import { format, differenceInDays, isBefore } from 'date-fns';

export default function FinancialReconciliationAudit() {

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['financial_reconciliation_audit'],
    queryFn: async () => {
      // Fetch invoices & expenses
      let [
        { data: invoices },
        { data: expenses }
      ] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('date', { ascending: false })
      ]);

      let invoicesList = invoices || [];
      let expensesList = expenses || [];




      return {
        invoices: invoicesList,
        expenses: expensesList
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

        if (e1.id === e2.id) continue;

        if (Number(e1.amount) === Number(e2.amount)) {
          const daysDiff = Math.abs(differenceInDays(new Date(e1.date), new Date(e2.date)));

          if (daysDiff <= 3 && e1.category === e2.category) {
            if (!possibleDuplicates.some(d => d.original.id === e1.id || d.original.id === e2.id)) {
              possibleDuplicates.push({
                original: e1,
                duplicateOf: e2,
                reason: `Identical charge of $${Number(e1.amount).toLocaleString()} under '${e1.category}' category within ${daysDiff} day(s)`
              });
            }
          }
        }

        if (Math.abs(differenceInDays(new Date(e1.date), new Date(e2.date))) > 14) {
          break;
        }
      }
    }

    // 4. Unusually High Cost Detection (Anomalies)
    const anomalies: any[] = [];
    if (data.expenses.length > 0) {
      const avgExpense = data.expenses.reduce((sum, e) => sum + Number(e.amount), 0) / data.expenses.length;
      const anomalyThreshold = avgExpense * 3;

      data.expenses.forEach(e => {
        if (Number(e.amount) > anomalyThreshold && Number(e.amount) > 100) {
          anomalies.push({
            ...e,
            threshold: Math.round(anomalyThreshold),
            ratio: (Number(e.amount) / avgExpense).toFixed(1),
            average: Math.round(avgExpense)
          });
        }
      });
    }

    return {
      totalPaidAmount,
      overdueInvoices,
      totalOverdueAmount,
      possibleDuplicates,
      anomalies: anomalies.sort((a, b) => Number(b.amount) - Number(a.amount))
    };
  }, [data]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10 flex flex-col lg:h-[calc(100vh-120px)] min-h-0 lg:overflow-hidden">

        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 dark:bg-slate-900/60 border border-border/60 backdrop-blur-xl p-5 rounded-2xl shadow-xl shadow-slate-100/30 dark:shadow-none shrink-0">
          <div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
              <FileWarning className="h-7 w-7 sm:h-8 sm:w-8 text-amber-500 animate-bounce" />
              Financial Reconciliation & Risk Audit
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Active ledger verification: Automatic algorithmic detection of duplicate billings, cost outliers, and aging receivables.
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="h-10 rounded-xl font-bold border-border/60 hover:bg-slate-50 dark:hover:bg-slate-950/20 text-slate-700 dark:text-slate-355 w-full sm:w-auto justify-center"
          >
            Re-Run Analysis
          </Button>
        </div>

        {/* STATS COUNTER STRIP */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-lg rounded-2xl">
              <CardContent className="p-4 sm:p-4.5 flex items-center gap-3 sm:gap-3.5">
                <div className="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-xl shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="truncate">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Paid Revenue</p>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 truncate">${stats.totalPaidAmount.toLocaleString()}</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-lg rounded-2xl">
              <CardContent className="p-4 sm:p-4.5 flex items-center gap-3 sm:gap-3.5">
                <div className="p-2.5 sm:p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-xl shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="truncate">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Aging Client Debt</p>
                  <h3 className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-455 truncate">${stats.totalOverdueAmount.toLocaleString()}</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-lg rounded-2xl">
              <CardContent className="p-4 sm:p-4.5 flex items-center gap-3 sm:gap-3.5">
                <div className="p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="truncate">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Duplicate Suspicions</p>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 truncate">{stats.possibleDuplicates.length} Matches</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-lg rounded-2xl">
              <CardContent className="p-4 sm:p-4.5 flex items-center gap-3 sm:gap-3.5">
                <div className="p-2.5 sm:p-3 bg-orange-50 dark:bg-orange-950/20 text-orange-500 rounded-xl shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="truncate">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Cost Anomalies</p>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 truncate">{stats.anomalies.length} Flagged</h3>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* LOADING INDICATOR */}
        {isLoading || !stats ? (
          <div className="flex flex-col items-center justify-center flex-1 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-slate-400">Calculating ledger reconciliations...</p>
          </div>
        ) : (

          /* VIEWPORT-CONSTRAINED GRID PANELS (FITS SCREEN EXACTLY) */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 lg:overflow-hidden">

            {/* COLUMN 1: AI TRANSACTION RISKS (DUPLICATES & OUTLIERS) */}
            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl flex flex-col min-h-0 lg:overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40 shrink-0 bg-slate-50/50 dark:bg-slate-950/10">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <ShieldCheck className="h-5 w-5 text-amber-500" />
                  AI Suspicious Expense Auditing
                </CardTitle>
                <CardDescription className="text-xs">
                  Automated duplicate billing isolation & cost anomaly multipliers.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 flex-1 lg:overflow-y-auto min-h-0 scrollbar-none space-y-6">

                {/* 1. DUPLICATE BILLING SUB-SECTION */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-ping" />
                    Double Billing Suspicion Matches ({stats.possibleDuplicates.length})
                  </h3>

                  {stats.possibleDuplicates.length === 0 ? (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 rounded-xl p-4 flex items-center gap-3 text-xs font-semibold">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      No duplicate charges, double-billings, or invoice matches found.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {stats.possibleDuplicates.map((dup, idx) => (
                        <div key={idx} className="bg-amber-500/5 dark:bg-amber-950/10 border border-amber-500/20 rounded-xl p-4 relative overflow-hidden transition-all hover:scale-[0.99] duration-150">
                          <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500" />
                          <div className="flex justify-between items-start mb-2 pl-1.5">
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 leading-tight">
                                {dup.original.title}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                Match category: <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-primary">{dup.original.category}</span>
                              </p>
                            </div>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-none font-black text-2xs py-0.5">
                              Double billing
                            </Badge>
                          </div>

                          <p className="text-2xs font-bold font-mono bg-white dark:bg-slate-950/45 p-2 rounded-lg border border-border/40 text-slate-500 dark:text-slate-350 leading-relaxed mb-2">
                            {dup.reason}
                          </p>

                          <div className="flex items-center gap-4 text-[10px] text-slate-400 font-semibold pl-1.5">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Event A: {format(new Date(dup.original.date), 'MMM dd, yyyy')}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Event B: {format(new Date(dup.duplicateOf.date), 'MMM dd, yyyy')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. COST ANOMALIES SUB-SECTION */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block animate-ping" />
                    Transaction Expense Anomalies & Outliers ({stats.anomalies.length})
                  </h3>

                  {stats.anomalies.length === 0 ? (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 rounded-xl p-4 flex items-center gap-3 text-xs font-semibold">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      All transactions reside nicely within standard deviation averages.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {stats.anomalies.map((anomaly, idx) => (
                        <div key={idx} className="border border-orange-500/20 bg-orange-500/5 dark:bg-orange-950/10 rounded-xl p-4 relative overflow-hidden transition-all hover:scale-[0.99] duration-150">
                          <div className="absolute top-0 bottom-0 left-0 w-1 bg-orange-500" />
                          <div className="flex justify-between items-start pl-1.5">
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 leading-tight">
                                {anomaly.title}
                              </h4>
                              <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">
                                Category: <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-primary">{anomaly.category}</span>
                              </p>
                            </div>
                            <span className="text-base font-black text-orange-600 dark:text-orange-400">
                              ${Number(anomaly.amount).toLocaleString()}
                            </span>
                          </div>

                          <div className="mt-3.5 bg-white dark:bg-slate-950/45 p-2 rounded-lg border border-border/40 text-2xs pl-2">
                            <div className="flex justify-between items-center font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                              <span>Anomaly Multiplier</span>
                              <span className="text-orange-600 dark:text-orange-400">{anomaly.ratio}x standard cost</span>
                            </div>
                            {/* Visual Bar Graph */}
                            <div className="w-full h-2 rounded bg-slate-100 dark:bg-slate-850 overflow-hidden relative border border-border/30">
                              <div className="h-full bg-orange-500 rounded" style={{ width: `${Math.min(Number(anomaly.ratio) * 10, 100)}%` }} />
                            </div>
                            <p className="text-[9px] text-slate-400 font-semibold mt-1">
                              This charge is significantly higher than the standard average category cost of ${anomaly.average}.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>

            {/* COLUMN 2: CLIENT RECEIVABLES & DEBT LEDGER (AGING RECEIVABLES) */}
            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl flex flex-col min-h-0 lg:overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40 shrink-0 bg-slate-50/50 dark:bg-slate-950/10">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <TrendingDown className="h-5 w-5 text-rose-500" />
                  Client Outstanding Receivables & Debt Aging
                </CardTitle>
                <CardDescription className="text-xs">
                  Critical unpaid accounts with elapsed invoice maturity dates.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 flex-1 lg:overflow-y-auto min-h-0 scrollbar-none">

                {stats.overdueInvoices.length === 0 ? (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 rounded-xl p-6 text-center flex flex-col items-center justify-center h-48 font-semibold text-xs">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2.5" />
                    Ledger is perfectly balanced.
                    <span className="text-[10px] text-slate-400 mt-1">No outstanding aging debts found!</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-border/40 rounded-xl bg-white/30 dark:bg-slate-950/20 w-full">
                    <table className="w-full text-sm text-left table-fixed min-w-[500px]">
                      <thead className="text-[10px] text-slate-455 uppercase bg-slate-50/75 dark:bg-slate-950/30 border-b border-border/40 sticky top-0 backdrop-blur-md z-10">
                        <tr>
                          <th className="px-4 py-3 font-black tracking-wider w-[22%]">Invoice #</th>
                          <th className="px-4 py-3 font-black tracking-wider w-[33%]">Client Name</th>
                          <th className="px-4 py-3 font-black tracking-wider w-[23%] text-right">Amount Due</th>
                          <th className="px-4 py-3 font-black tracking-wider w-[22%] text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {stats.overdueInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors duration-150">
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-bold font-mono text-slate-600 dark:text-slate-350 select-all">
                              {inv.invoice_number}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-bold text-slate-800 dark:text-slate-200">
                              <span className="truncate block max-w-full" title={inv.client_name}>
                                {inv.client_name || 'Unknown Client'}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-black text-rose-600 dark:text-rose-455 text-right">
                              ${Number(inv.total_amount).toLocaleString()}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none font-black text-2xs px-2 py-0.5 rounded-lg select-none">
                                {inv.daysOverdue} days late
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
