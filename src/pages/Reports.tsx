import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLog } from '@/hooks/useActivityLog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Download,
  FolderKanban,
  DollarSign,
  Users,
  TrendingUp,
  BarChart3,
  Calendar,
  Loader2,
  PieChart,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(271, 81%, 56%)', 'hsl(0, 84%, 60%)', 'hsl(199, 89%, 48%)'];

export default function Reports() {
  const { role } = useAuth();
  const { logActivity, logSecurity } = useActivityLog();
  const [selectedPeriod, setSelectedPeriod] = useState('6');

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['reports-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['reports-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: role === 'admin',
  });

  // Fetch payroll
  const { data: payroll = [] } = useQuery({
    queryKey: ['reports-payroll'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payroll_log').select('*');
      if (error) throw error;
      return data;
    },
    enabled: role === 'admin',
  });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['reports-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = data.map((e) => e.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      return data.map((emp) => ({ ...emp, profile: profileMap.get(emp.user_id) }));
    },
    enabled: role === 'admin',
  });

  // Fetch leads
  const { data: leads = [] } = useQuery({
    queryKey: ['reports-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch leave applications
  const { data: leaveApplications = [] } = useQuery({
    queryKey: ['reports-leave'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: role === 'admin',
  });

  // Calculate project statistics
  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const completedProjects = projects.filter((p) => p.status === 'completed').length;
  const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_budget || 0), 0);
  const totalPaid = projects.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);

  // Projects by type
  const projectsByType = projects.reduce((acc, p) => {
    const type = p.project_type || 'Other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const projectTypeData = Object.entries(projectsByType).map(([name, value], idx) => ({
    name,
    value,
    color: COLORS[idx % COLORS.length],
  }));

  // Projects by stage
  const projectsByStage = projects.reduce((acc, p) => {
    const stage = p.stage || 'discovery';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stageLabels: Record<string, string> = {
    discovery: 'Discovery',
    design: 'Design',
    development: 'Development',
    review: 'Review',
    launch: 'Launch',
  };

  const projectStageData = Object.entries(projectsByStage).map(([name, value]) => ({
    name: stageLabels[name] || name,
    count: value,
  }));

  // Financial calculations
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalPayroll = payroll.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  const netProfit = totalBudget - totalExpenses - totalPayroll;

  // Monthly financial data
  const months = parseInt(selectedPeriod);
  const monthlyFinancialData = Array.from({ length: months }, (_, i) => {
    const date = subMonths(new Date(), months - 1 - i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const monthRevenue = projects
      .filter((p) => {
        const startDate = new Date(p.start_date);
        return startDate >= monthStart && startDate <= monthEnd;
      })
      .reduce((sum, p) => sum + Number(p.total_budget || 0), 0);

    const monthExpenses = expenses
      .filter((e) => {
        const expDate = new Date(e.date);
        return expDate >= monthStart && expDate <= monthEnd;
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const monthPayroll = payroll
      .filter((p) => {
        const payDate = new Date(p.payment_date);
        return payDate >= monthStart && payDate <= monthEnd;
      })
      .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

    return {
      month: format(date, 'MMM yy'),
      revenue: monthRevenue,
      expenses: monthExpenses,
      payroll: monthPayroll,
      profit: monthRevenue - monthExpenses - monthPayroll,
    };
  });

  // Expenses by category
  const expensesByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const expenseCategoryData = Object.entries(expensesByCategory).map(([name, value], idx) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    value,
    color: COLORS[idx % COLORS.length],
  }));

  // Team statistics
  const activeEmployees = employees.filter((e) => e.status === 'active').length;
  const totalSalaries = employees
    .filter((e) => e.status === 'active')
    .reduce((sum, e) => sum + Number(e.base_salary || 0), 0);
  const pendingLeave = leaveApplications.filter((l) => l.status === 'pending').length;
  const approvedLeave = leaveApplications.filter((l) => l.status === 'approved').length;

  // Employees by department
  const employeesByDept = employees.reduce((acc, e) => {
    const dept = e.department || 'Unassigned';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deptData = Object.entries(employeesByDept).map(([name, value], idx) => ({
    name,
    value,
    color: COLORS[idx % COLORS.length],
  }));

  // Lead statistics
  const leadsByStatus = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const leadStatusLabels: Record<string, string> = {
    new: 'New',
    contacted: 'Contacted',
    in_negotiation: 'In Negotiation',
    deal_won: 'Deal Won',
    deal_lost: 'Deal Lost',
  };

  const leadStatusData = Object.entries(leadsByStatus).map(([status, count]) => ({
    name: leadStatusLabels[status] || status,
    count,
  }));

  // Export functions
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) =>
      Object.values(row)
        .map((val) => `"${val}"`)
        .join(',')
    );
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
    logActivity('exported', 'report', `${filename}.csv`);
    logSecurity('EXPORT', 'REPORT', `Exported "${filename}" report to CSV format`);
  };

  const exportProjectReport = () => {
    const data = projects.map((p) => ({
      'Project Name': p.project_name,
      Client: p.client_name,
      Type: p.project_type,
      Status: p.status,
      Stage: stageLabels[p.stage] || p.stage,
      'Total Budget': Number(p.total_budget),
      'Paid Amount': Number(p.paid_amount),
      Pending: Number(p.total_budget) - Number(p.paid_amount),
      'Start Date': p.start_date,
      Deadline: p.deadline || 'N/A',
    }));
    exportToCSV(data, 'project_report');
  };

  const exportFinancialReport = () => {
    const data = monthlyFinancialData.map((m) => ({
      Month: m.month,
      Revenue: m.revenue,
      Expenses: m.expenses,
      Payroll: m.payroll,
      'Net Profit': m.profit,
    }));
    exportToCSV(data, 'financial_report');
  };

  const exportTeamReport = () => {
    const data = employees.map((e) => ({
      Name: e.profile?.full_name || 'Unknown',
      Designation: e.designation,
      Department: e.department || 'N/A',
      Status: e.status,
      'Base Salary': Number(e.base_salary),
      'Joining Date': e.joining_date,
    }));
    exportToCSV(data, 'team_report');
  };

  if (projectsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in pb-12">
        
        {/* Header Title Grid */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-200/50 dark:border-slate-800/30 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:via-indigo-200 dark:to-white bg-clip-text text-transparent">
              Reports Hub
            </h1>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed max-w-xl">
              Extract, aggregate, and analyze performance statistics, operational costs, and client pipelines across your enterprise workspace.
            </p>
          </div>
          
          <div className="shrink-0">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[190px] rounded-xl border-slate-200/80 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/40 backdrop-blur-md shadow-sm font-semibold text-xs">
                <Calendar className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200/80 dark:border-slate-800/80">
                <SelectItem value="3" className="text-xs font-medium">Last 3 Months</SelectItem>
                <SelectItem value="6" className="text-xs font-medium">Last 6 Months</SelectItem>
                <SelectItem value="12" className="text-xs font-medium">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Premium Tab Navigation */}
        <Tabs defaultValue="projects" className="space-y-8">
          <div className="flex justify-center md:justify-start">
            <TabsList className="flex w-full overflow-x-auto p-1 bg-slate-100/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-800/30 gap-1.5 h-auto max-w-md md:max-w-xl">
              <TabsTrigger 
                value="projects" 
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-md data-[state=active]:border-indigo-100/50 dark:data-[state=active]:border-indigo-900/20 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              >
                <FolderKanban className="h-4 w-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger 
                value="financial" 
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-md data-[state=active]:border-indigo-100/50 dark:data-[state=active]:border-indigo-900/20 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              >
                <DollarSign className="h-4 w-4" />
                Financial
              </TabsTrigger>
              <TabsTrigger 
                value="team" 
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-md data-[state=active]:border-indigo-100/50 dark:data-[state=active]:border-indigo-900/20 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              >
                <Users className="h-4 w-4" />
                Team
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ==================================================================== */}
          {/* PROJECTS TAB REPORT */}
          {/* ==================================================================== */}
          <TabsContent value="projects" className="space-y-8 outline-none">
            <div className="flex justify-end">
              <Button onClick={exportProjectReport} className="rounded-xl gradient-primary text-xs font-semibold px-4 py-2 shadow-sm transition-all duration-300 hover:scale-[1.02]">
                <Download className="h-4 w-4 mr-2" />
                Export Project Report
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1 */}
              <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Total Projects</p>
                    <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">{totalProjects}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <FolderKanban className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Card 2 */}
              <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group border-l-emerald-500/60 dark:border-l-emerald-500/40 border-l-[3px]">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent dark:from-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Active Workspaces</p>
                    <p className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">{activeProjects}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Card 3 */}
              <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent dark:from-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Cumulative Value</p>
                    <p className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-50">{formatCurrency(totalBudget)}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              {/* Card 4 */}
              <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group border-l-amber-500/60 dark:border-l-amber-500/40 border-l-[3px]">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent dark:from-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Collected Income</p>
                    <p className="text-xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
              
              {/* Projects by Type */}
              <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/30 pb-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Projects by Scope</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[300px]">
                    {projectTypeData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie 
                            data={projectTypeData} 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={70} 
                            outerRadius={105} 
                            paddingAngle={4} 
                            dataKey="value"
                            animationDuration={1000}
                          >
                            {projectTypeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(15, 23, 42, 0.95)',
                              borderRadius: '12px',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#fff',
                              fontSize: '11px',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                              backdropFilter: 'blur(8px)'
                            }}
                            itemStyle={{ color: '#fff' }}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" className="text-xs" />
                        </RePieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 italic text-xs">No active data points listed</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Projects by Stage */}
              <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/30 pb-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Pipeline Stages</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectStageData} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800/40" />
                        <XAxis dataKey="name" className="text-[10px] text-slate-400 font-semibold" tickLine={false} />
                        <YAxis className="text-[10px] text-slate-400 font-semibold" tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#fff',
                            fontSize: '11px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                            backdropFilter: 'blur(8px)'
                          }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="count" fill="url(#indigoGrad)" radius={[6, 6, 0, 0]}>
                          <defs>
                            <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.8} />
                            </linearGradient>
                          </defs>
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lead Pipeline */}
            <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/30 pb-4">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Lead Funnel Distribution</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadStatusData} layout="vertical" barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-100 dark:stroke-slate-800/40" />
                      <XAxis type="number" className="text-[10px] text-slate-400 font-semibold" tickLine={false} />
                      <YAxis dataKey="name" type="category" width={120} className="text-[10px] text-slate-400 font-semibold" tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          fontSize: '11px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                          backdropFilter: 'blur(8px)'
                        }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="count" fill="url(#violetGrad)" radius={[0, 6, 6, 0]}>
                        <defs>
                          <linearGradient id="violetGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8} />
                          </linearGradient>
                        </defs>
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================================================================== */}
          {/* FINANCIAL TAB REPORT */}
          {/* ==================================================================== */}
          <TabsContent value="financial" className="space-y-8 outline-none">
            {role !== 'admin' ? (
              <Card className="border-slate-200/60 dark:border-slate-800/40 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl shadow-sm">
                <CardContent className="py-16 text-center space-y-3">
                  <div className="inline-block p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-500">
                    <DollarSign className="h-10 w-10 animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Restricted Directory</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Financial records are strictly classified and only accessible to verified accounts with Administrative access tokens.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button onClick={exportFinancialReport} className="rounded-xl gradient-primary text-xs font-semibold px-4 py-2 shadow-sm transition-all duration-300 hover:scale-[1.02]">
                    <Download className="h-4 w-4 mr-2" />
                    Export Financial Report
                  </Button>
                </div>

                {/* Financial Summary */}
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Card 1 */}
                  <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Total Revenue</p>
                        <p className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-50">{formatCurrency(totalBudget)}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <DollarSign className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 2 */}
                  <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group border-l-rose-500/60 dark:border-l-rose-500/40 border-l-[3px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent dark:from-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Total Expenses</p>
                        <p className="text-xl font-black tracking-tight text-rose-600 dark:text-rose-400">{formatCurrency(totalExpenses)}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <DollarSign className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 3 */}
                  <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group border-l-amber-500/60 dark:border-l-amber-500/40 border-l-[3px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent dark:from-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Payroll Costs</p>
                        <p className="text-xl font-black tracking-tight text-amber-600 dark:text-amber-400">{formatCurrency(totalPayroll)}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <DollarSign className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 4 */}
                  <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group border-l-emerald-500/60 dark:border-l-emerald-500/40 border-l-[3px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent dark:from-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Net Profit</p>
                        <p className={`text-xl font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>{formatCurrency(netProfit)}</p>
                      </div>
                      <div className={`p-3.5 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm ${netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 text-rose-600'}`}>
                        <DollarSign className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Financial Trend */}
                <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800/30 pb-4">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Revenue, Expenses, and Profit Trends</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyFinancialData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800/40" />
                          <XAxis dataKey="month" className="text-[10px] text-slate-400 font-semibold" tickLine={false} />
                          <YAxis className="text-[10px] text-slate-400 font-semibold" tickLine={false} axisLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}K`} />
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{
                              backgroundColor: 'rgba(15, 23, 42, 0.95)',
                              borderRadius: '12px',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#fff',
                              fontSize: '11px',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                              backdropFilter: 'blur(8px)'
                            }}
                            itemStyle={{ color: '#fff' }}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" className="text-xs" />
                          <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={3} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={3} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Expenses by Category */}
                <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800/30 pb-4">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Expenses by Category</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="h-[300px]">
                      {expenseCategoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie 
                              data={expenseCategoryData} 
                              cx="50%" 
                              cy="50%" 
                              innerRadius={70} 
                              outerRadius={105} 
                              paddingAngle={4} 
                              dataKey="value"
                              animationDuration={1000}
                            >
                              {expenseCategoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number) => formatCurrency(value)}
                              contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#fff',
                                fontSize: '11px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                backdropFilter: 'blur(8px)'
                              }}
                              itemStyle={{ color: '#fff' }}
                            />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" className="text-xs" />
                          </RePieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 italic text-xs">No active expense data recorded</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ==================================================================== */}
          {/* TEAM TAB REPORT */}
          {/* ==================================================================== */}
          <TabsContent value="team" className="space-y-8 outline-none">
            {role !== 'admin' ? (
              <Card className="border-slate-200/60 dark:border-slate-800/40 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl shadow-sm">
                <CardContent className="py-16 text-center space-y-3">
                  <div className="inline-block p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-500">
                    <Users className="h-10 w-10 animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Restricted Directory</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Team structure and payroll audits are strictly classified and only accessible to verified accounts with Administrative access tokens.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button onClick={exportTeamReport} className="rounded-xl gradient-primary text-xs font-semibold px-4 py-2 shadow-sm transition-all duration-300 hover:scale-[1.02]">
                    <Download className="h-4 w-4 mr-2" />
                    Export Team Report
                  </Button>
                </div>

                {/* Team Summary */}
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Card 1 */}
                  <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Active Directory</p>
                        <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">{employees.length}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <Users className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 2 */}
                  <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group border-l-emerald-500/60 dark:border-l-emerald-500/40 border-l-[3px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent dark:from-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Active Status</p>
                        <p className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">{activeEmployees}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <Users className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 3 */}
                  <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group border-l-violet-500/60 dark:border-l-violet-500/40 border-l-[3px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent dark:from-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Monthly Payroll Liability</p>
                        <p className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-50">{formatCurrency(totalSalaries)}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <DollarSign className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 4 */}
                  <Card className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group border-l-amber-500/60 dark:border-l-amber-500/40 border-l-[3px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent dark:from-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pending Leaves</p>
                        <p className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">{pendingLeave}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <Users className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Distribution */}
                <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
                  {/* Department Distribution */}
                  <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800/30 pb-4">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Department Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="h-[300px]">
                        {deptData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                              <Pie 
                                data={deptData} 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={70} 
                                outerRadius={105} 
                                paddingAngle={4} 
                                dataKey="value"
                                animationDuration={1000}
                              >
                                {deptData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                  borderRadius: '12px',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  color: '#fff',
                                  fontSize: '11px',
                                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                  backdropFilter: 'blur(8px)'
                                }}
                                itemStyle={{ color: '#fff' }}
                              />
                              <Legend verticalAlign="bottom" height={36} iconType="circle" className="text-xs" />
                            </RePieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-400 italic text-xs">No active department datasets</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Leave Statistics */}
                  <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800/30 pb-4">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Leave Statistics Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/30 rounded-2xl shadow-sm transition-all hover:scale-[1.01]">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pending Approvals</span>
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200/50 bg-amber-50/50 px-3 py-1 rounded-xl">{pendingLeave}</Badge>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/30 rounded-2xl shadow-sm transition-all hover:scale-[1.01]">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Approved This Month</span>
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200/50 bg-emerald-50/50 px-3 py-1 rounded-xl">{approvedLeave}</Badge>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/30 rounded-2xl shadow-sm transition-all hover:scale-[1.01]">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Total Applications Received</span>
                          <Badge variant="secondary" className="text-xs px-3 py-1 rounded-xl bg-slate-100 text-slate-600">{leaveApplications.length}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Employee Directory */}
                <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800/30 pb-4">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Employee Directory Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-950/20">
                          <TableRow className="border-b border-slate-100 dark:border-slate-800/30">
                            <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-4 px-6">Name</TableHead>
                            <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-4 px-6">Designation</TableHead>
                            <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-4 px-6">Department</TableHead>
                            <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-4 px-6">Status</TableHead>
                            <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-4 px-6 text-right">Salary</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employees.map((emp) => (
                            <TableRow key={emp.id} className="border-b border-slate-100 dark:border-slate-800/20 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                              <TableCell className="font-semibold text-slate-800 dark:text-slate-200 py-4 px-6">{emp.profile?.full_name || 'Unknown'}</TableCell>
                              <TableCell className="text-xs text-slate-500 py-4 px-6">{emp.designation}</TableCell>
                              <TableCell className="text-xs text-slate-500 py-4 px-6">{emp.department || 'N/A'}</TableCell>
                              <TableCell className="py-4 px-6">
                                <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-xl ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-600'}`}>
                                  {emp.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200 py-4 px-6">{formatCurrency(emp.base_salary)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
