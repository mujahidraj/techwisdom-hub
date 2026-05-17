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
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1">Generate and export comprehensive reports.</p>
          </div>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 Months</SelectItem>
              <SelectItem value="6">Last 6 Months</SelectItem>
              <SelectItem value="12">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
          </TabsList>

          {/* Projects Report */}
          <TabsContent value="projects" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={exportProjectReport}>
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Projects</p>
                      <p className="text-2xl font-bold">{totalProjects}</p>
                    </div>
                    <FolderKanban className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active</p>
                      <p className="text-2xl font-bold text-success">{activeProjects}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-success" />
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Budget</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Collected</p>
                      <p className="text-2xl font-bold text-success">{formatCurrency(totalPaid)}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-success" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Projects by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {projectTypeData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie data={projectTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                            {projectTypeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </RePieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Projects by Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectStageData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lead Conversion */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Lead Pipeline</CardTitle>
                <CardDescription>Leads by status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadStatusData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(271, 81%, 56%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial Report */}
          <TabsContent value="financial" className="space-y-6">
            {role !== 'admin' ? (
              <Card className="glass-card">
                <CardContent className="py-12 text-center">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Financial reports are only available to admins.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button onClick={exportFinancialReport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>

                {/* Financial Summary */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="glass-card">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Expenses</p>
                      <p className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Payroll Costs</p>
                      <p className="text-2xl font-bold text-warning">{formatCurrency(totalPayroll)}</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Net Profit</p>
                      <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(netProfit)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Financial Trend Chart */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Financial Trend</CardTitle>
                    <CardDescription>Revenue, expenses, and profit over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyFinancialData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis className="text-xs" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}K`} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                          <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(217, 91%, 60%)" strokeWidth={2} />
                          <Line type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(0, 84%, 60%)" strokeWidth={2} />
                          <Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(142, 71%, 45%)" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Expenses by Category */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Expenses by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {expenseCategoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie data={expenseCategoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                              {expenseCategoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                          </RePieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">No expense data</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Team Report */}
          <TabsContent value="team" className="space-y-6">
            {role !== 'admin' ? (
              <Card className="glass-card">
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Team reports are only available to admins.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button onClick={exportTeamReport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>

                {/* Team Summary */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="glass-card">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Employees</p>
                      <p className="text-2xl font-bold">{employees.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Active</p>
                      <p className="text-2xl font-bold text-success">{activeEmployees}</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Monthly Salaries</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalSalaries)}</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Pending Leave</p>
                      <p className="text-2xl font-bold text-warning">{pendingLeave}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Department Distribution */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Employees by Department</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        {deptData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                              <Pie data={deptData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                {deptData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </RePieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Leave Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span>Pending Approvals</span>
                          <Badge variant="outline" className="text-warning border-warning">{pendingLeave}</Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span>Approved This Month</span>
                          <Badge variant="outline" className="text-success border-success">{approvedLeave}</Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span>Total Applications</span>
                          <Badge variant="secondary">{leaveApplications.length}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Employee Table */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Employee Directory</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Designation</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Salary</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employees.map((emp) => (
                            <TableRow key={emp.id}>
                              <TableCell className="font-medium">{emp.profile?.full_name || 'Unknown'}</TableCell>
                              <TableCell>{emp.designation}</TableCell>
                              <TableCell>{emp.department || 'N/A'}</TableCell>
                              <TableCell>
                                <Badge variant={emp.status === 'active' ? 'default' : 'secondary'}>{emp.status}</Badge>
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(emp.base_salary)}</TableCell>
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
