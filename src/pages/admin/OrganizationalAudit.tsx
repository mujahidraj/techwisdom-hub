import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, TrendingUp, DollarSign, Users, Briefcase, Activity, ArrowUpRight, ArrowDownRight, MessageSquare, Zap, Target, HelpCircle, UserPlus, Laptop } from 'lucide-react';
import { format, subMonths, subWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

export default function OrganizationalAudit() {
  const [viewType, setViewType] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedRange, setSelectedRange] = useState<string>(
    viewType === 'monthly' ? format(new Date(), 'yyyy-MM') : format(new Date(), 'yyyy-ww')
  );

  // Generate options based on viewType
  const dateOptions = useMemo(() => {
    if (viewType === 'monthly') {
      return Array.from({ length: 12 }, (_, i) => {
        const d = subMonths(new Date(), i);
        return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
      });
    } else {
      return Array.from({ length: 12 }, (_, i) => {
        const d = subWeeks(new Date(), i);
        return { 
          value: format(d, 'yyyy-ww'), 
          label: `Week of ${format(startOfWeek(d), 'MMM do')} - ${format(endOfWeek(d), 'MMM do, yyyy')}` 
        };
      });
    }
  }, [viewType]);

  // Handle toggle safely
  const handleViewChange = (newView: 'monthly' | 'weekly') => {
    setViewType(newView);
    setSelectedRange(
      newView === 'monthly' ? format(new Date(), 'yyyy-MM') : format(new Date(), 'yyyy-ww')
    );
  };

  const { data, isLoading } = useQuery({
    queryKey: ['org_audit', viewType, selectedRange],
    queryFn: async () => {
      let start, end;
      if (viewType === 'monthly') {
        const year = parseInt(selectedRange.split('-')[0]);
        const month = parseInt(selectedRange.split('-')[1]) - 1;
        start = startOfMonth(new Date(year, month)).toISOString();
        end = endOfMonth(new Date(year, month)).toISOString();
      } else {
        const year = parseInt(selectedRange.split('-')[0]);
        // Week number logic approximation (fallback to subWeeks match from dateOptions)
        // A safer way is to just find the date from the dateOptions list or use date-fns `setWeek`
        // For simplicity since we generated backwards from today, we can just find how many weeks ago it was
        const optionIndex = dateOptions.findIndex(o => o.value === selectedRange);
        const targetDate = optionIndex !== -1 ? subWeeks(new Date(), optionIndex) : new Date();
        start = startOfWeek(targetDate).toISOString();
        end = endOfWeek(targetDate).toISOString();
      }

      // Parallel data fetching for the selected period
      const [
        { data: invoices },
        { data: expenses },
        { data: employees },
        { data: leads },
        { data: proposals },
        { data: projects },
        { data: leaveRequests },
        { data: teamMessages },
        { data: clientMessages },
        { data: itTickets },
        { data: workflowExecutions },
        { data: okrObjectives },
        { data: atsCandidates },
        { data: atsInterviews },
        { data: assets }
      ] = await Promise.all([
        supabase.from('invoices').select('*').gte('created_at', start).lte('created_at', end),
        supabase.from('expenses').select('*').gte('created_at', start).lte('created_at', end),
        supabase.from('employees').select('*'), // Need all active employees for payroll calculation
        supabase.from('leads').select('*').gte('created_at', start).lte('created_at', end),
        supabase.from('proposals').select('*').gte('created_at', start).lte('created_at', end),
        supabase.from('active_projects').select('*').gte('created_at', start).lte('created_at', end), // mapped to projects
        supabase.from('leave_applications').select('*').gte('created_at', start).lte('created_at', end),
        
        // The 8 new tables
        supabase.from('team_messages').select('id').gte('created_at', start).lte('created_at', end),
        supabase.from('client_messages').select('id').gte('created_at', start).lte('created_at', end),
        supabase.from('it_tickets').select('*').gte('created_at', start).lte('created_at', end),
        supabase.from('workflow_executions').select('id, status').gte('created_at', start).lte('created_at', end),
        supabase.from('okr_objectives').select('*').gte('created_at', start).lte('created_at', end),
        supabase.from('ats_candidates').select('*').gte('created_at', start).lte('created_at', end),
        supabase.from('ats_interviews').select('*').gte('created_at', start).lte('created_at', end),
        supabase.from('assets').select('*').gte('created_at', start).lte('created_at', end),
      ]);

      return {
        invoices: invoices || [],
        expenses: expenses || [],
        employees: employees || [],
        leads: leads || [],
        proposals: proposals || [],
        projects: projects || [],
        leaveRequests: leaveRequests || [],
        teamMessages: teamMessages || [],
        clientMessages: clientMessages || [],
        itTickets: itTickets || [],
        workflowExecutions: workflowExecutions || [],
        okrObjectives: okrObjectives || [],
        atsCandidates: atsCandidates || [],
        atsInterviews: atsInterviews || [],
        assets: assets || []
      };
    }
  });

  const stats = useMemo(() => {
    if (!data) return null;

    // Financial
    const revenue = data.invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total_amount), 0);
    const pendingRevenue = data.invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + Number(i.total_amount), 0);
    const opExpenses = data.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    // Adjust payroll for weekly view (divide by 4 roughly)
    const rawPayroll = data.employees.filter(e => e.status === 'active').reduce((sum, e) => sum + Number(e.base_salary), 0);
    const payroll = viewType === 'weekly' ? rawPayroll / 4 : rawPayroll;
    
    const totalExpenses = opExpenses + payroll;
    const netProfit = revenue - totalExpenses;

    // HR Core
    const activeEmployees = data.employees.filter(e => e.status === 'active').length;
    const newHires = data.employees.filter(e => {
        const d = new Date(e.joining_date || e.created_at);
        if (viewType === 'monthly') return format(d, 'yyyy-MM') === selectedRange;
        return true; // Simplification for weekly new hires based on DB filter
    }).length;
    const leaveDays = data.leaveRequests.filter(l => l.status === 'approved').length; 

    // CRM & Sales (Real calculations mapped to precise DB schema)
    const totalLeads = data.leads.length;
    const wonLeads = data.leads.filter(l => l.status === 'deal_won').length;
    const lostLeads = data.leads.filter(l => l.status === 'deal_lost').length;
    const followUps = data.leads.filter(l => l.next_follow_up !== null).length;
    
    // Find top lead source
    const sourceCount: Record<string, number> = {};
    data.leads.forEach(l => {
      if (l.source) sourceCount[l.source] = (sourceCount[l.source] || 0) + 1;
    });
    const topSource = Object.entries(sourceCount).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const winRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0';
    
    const totalProposals = data.proposals.length;
    const acceptedProposals = data.proposals.filter(p => p.status === 'accepted');
    const pendingProposals = data.proposals.filter(p => p.status === 'sent' || p.status === 'draft');
    
    const proposalValue = acceptedProposals.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
    const pipelineValue = pendingProposals.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
    const avgDealSize = acceptedProposals.length > 0 ? (proposalValue / acceptedProposals.length) : 0;
    const proposalAcceptanceRate = totalProposals > 0 ? ((acceptedProposals.length / totalProposals) * 100).toFixed(1) : '0';

    // Operations Core
    const activeProjects = data.projects.filter(p => p.status !== 'completed').length;
    const completedProjects = data.projects.filter(p => p.status === 'completed').length;

    // Extended 8 Metrics
    const teamMsgCount = data.teamMessages.length;
    const clientMsgCount = data.clientMessages.length;
    const totalTickets = data.itTickets.length;
    const resolvedTickets = data.itTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const workflowsRun = data.workflowExecutions.length;
    const okrsCreated = data.okrObjectives.length;
    const candidatesAdded = data.atsCandidates.length;
    const interviewsHeld = data.atsInterviews.length;
    const activeAssets = data.assets.filter(a => a.status === 'assigned').length;

    return {
      financial: { revenue, pendingRevenue, opExpenses, payroll, totalExpenses, netProfit },
      hr: { activeEmployees, newHires, leaveDays, candidatesAdded, interviewsHeld },
      sales: { totalLeads, wonLeads, lostLeads, followUps, topSource, pipelineValue, winRate, avgDealSize, totalProposals, acceptedProposals: acceptedProposals.length, proposalValue, proposalAcceptanceRate },
      ops: { activeProjects, completedProjects, totalTickets, resolvedTickets, activeAssets },
      comm: { teamMsgCount, clientMsgCount, workflowsRun, okrsCreated }
    };
  }, [data, selectedRange, viewType]);

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value\n"
      + `Total Revenue,$${stats?.financial.revenue}\n`
      + `Net Profit,$${stats?.financial.netProfit}\n`
      + `Total Payroll,$${stats?.financial.payroll}\n`
      + `New Leads,${stats?.sales.totalLeads}\n`
      + `Won Leads,${stats?.sales.wonLeads}\n`
      + `Win Rate,${stats?.sales.winRate}%\n`
      + `Proposal Acceptance,${stats?.sales.proposalAcceptanceRate}%\n`
      + `Active Projects,${stats?.ops.activeProjects}\n`
      + `Internal Messages,${stats?.comm.teamMsgCount}\n`
      + `Client Messages,${stats?.comm.clientMsgCount}\n`
      + `Workflows Run,${stats?.comm.workflowsRun}\n`
      + `Helpdesk Tickets,${stats?.ops.totalTickets}\n`
      + `Candidates Added,${stats?.hr.candidatesAdded}\n`
      + `Interviews Held,${stats?.hr.interviewsHeld}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `org_audit_${selectedRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-8 w-8 text-primary" />
              Organizational Audit
            </h1>
            <p className="text-muted-foreground mt-1">Full-spectrum company performance overview.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Tabs value={viewType} onValueChange={(v) => handleViewChange(v as any)} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Select value={selectedRange} onValueChange={setSelectedRange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleExport} disabled={!stats} className="gap-2">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        {isLoading || !stats ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* FINANCIAL HEALTH */}
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2">
                <DollarSign className="h-5 w-5 text-success" /> Financial Health
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Collected Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-success">${stats.financial.revenue.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">From paid invoices</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">${stats.financial.totalExpenses.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">${stats.financial.payroll.toLocaleString()} Payroll + ${stats.financial.opExpenses.toLocaleString()} Ops</p>
                  </CardContent>
                </Card>
                <Card className={`glass-card border-l-4 ${stats.financial.netProfit >= 0 ? 'border-l-success' : 'border-l-destructive'}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${stats.financial.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      ${stats.financial.netProfit.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Revenue - Expenses</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pending Receivables</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-warning">${stats.financial.pendingRevenue.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">Unpaid invoices</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* SALES & CRM */}
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Sales & CRM Pipeline
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Lead Generation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.sales.totalLeads}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-success text-[10px]"><ArrowUpRight className="h-3 w-3 mr-1"/>{stats.sales.wonLeads} Won</Badge>
                      <Badge variant="outline" className="text-destructive text-[10px]"><ArrowDownRight className="h-3 w-3 mr-1"/>{stats.sales.lostLeads} Lost</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Sales Win Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.sales.winRate}%</div>
                    <p className="text-xs text-muted-foreground mt-1">Avg Deal: ${stats.sales.avgDealSize.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Proposals Delivered</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.sales.totalProposals}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stats.sales.proposalAcceptanceRate}% Acceptance Rate</p>
                  </CardContent>
                </Card>
                <Card className="glass-card bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Active Pipeline Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">${stats.sales.pipelineValue.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">From sent & drafted proposals</p>
                  </CardContent>
                </Card>
                
                {/* Extra CRM Metrics */}
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue Secured</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-success">${stats.sales.proposalValue.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">From accepted proposals</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Active Follow-ups</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.sales.followUps}</div>
                    <p className="text-xs text-muted-foreground mt-1">Leads with scheduled follow-ups</p>
                  </CardContent>
                </Card>
                <Card className="glass-card md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Top Lead Source</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold capitalize">{stats.sales.topSource}</div>
                    <p className="text-xs text-muted-foreground mt-1">Most successful acquisition channel</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* EXTENDED AUDIT: OPS, HR, COMMS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* HR & ATS */}
              <section>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2">
                  <Users className="h-4 w-4 text-indigo-500" /> Human Resources
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><UserPlus className="h-4 w-4"/> ATS Candidates</span>
                    <span className="font-bold">{stats.hr.candidatesAdded}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4"/> Interviews Held</span>
                    <span className="font-bold">{stats.hr.interviewsHeld}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4"/> Active Headcount</span>
                    <span className="font-bold">{stats.hr.activeEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Activity className="h-4 w-4"/> Approved Leaves</span>
                    <span className="font-bold">{stats.hr.leaveDays}</span>
                  </div>
                </div>
              </section>

              {/* OPERATIONS & SUPPORT */}
              <section>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2">
                  <Briefcase className="h-4 w-4 text-orange-500" /> Operations
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><HelpCircle className="h-4 w-4"/> IT Tickets (Total/Resolved)</span>
                    <span className="font-bold">{stats.ops.totalTickets} / {stats.ops.resolvedTickets}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Target className="h-4 w-4"/> OKR Objectives Set</span>
                    <span className="font-bold">{stats.comm.okrsCreated}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Laptop className="h-4 w-4"/> Active Assets In-Use</span>
                    <span className="font-bold">{stats.ops.activeAssets}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Briefcase className="h-4 w-4"/> Active Projects</span>
                    <span className="font-bold">{stats.ops.activeProjects}</span>
                  </div>
                </div>
              </section>

              {/* COMMUNICATION & SYSTEM */}
              <section>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2">
                  <MessageSquare className="h-4 w-4 text-pink-500" /> Communications & System
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><MessageSquare className="h-4 w-4"/> Internal Chat Msgs</span>
                    <span className="font-bold">{stats.comm.teamMsgCount}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><MessageSquare className="h-4 w-4"/> Client Portal Msgs</span>
                    <span className="font-bold">{stats.comm.clientMsgCount}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Zap className="h-4 w-4"/> Workflows Triggered</span>
                    <span className="font-bold">{stats.comm.workflowsRun}</span>
                  </div>
                </div>
              </section>

            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
