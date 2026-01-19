import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, FolderKanban, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, MessageSquare, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  // Fetch leads count and stats
  const { data: leadsData } = useQuery({
    queryKey: ['dashboard-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, status, created_at');
      if (error) throw error;
      return data;
    },
  });

  // Fetch active projects
  const { data: projectsData } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_projects')
        .select('id, status, total_budget, paid_amount, project_name, client_name, stage, deadline');
      if (error) throw error;
      return data;
    },
  });

  // Fetch expenses
  const { data: expensesData } = useQuery({
    queryKey: ['dashboard-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount');
      if (error) throw error;
      return data;
    },
  });

  // Fetch unread messages count
  const { data: unreadMessages } = useQuery({
    queryKey: ['dashboard-unread-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_messages')
        .select('id')
        .eq('is_read', false);
      if (error) throw error;
      return data?.length || 0;
    },
  });

  // Fetch recent leads for activity
  const { data: recentLeads } = useQuery({
    queryKey: ['dashboard-recent-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, business_name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  // Calculate stats
  const totalLeads = leadsData?.length || 0;
  const activeProjects = projectsData?.filter(p => p.status === 'active')?.length || 0;
  const wonDeals = leadsData?.filter(l => l.status === 'deal_won')?.length || 0;
  const conversionRate = totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0;
  const totalRevenue = projectsData?.reduce((sum, p) => sum + Number(p.total_budget || 0), 0) || 0;
  const totalPaid = projectsData?.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0) || 0;
  const totalExpenses = expensesData?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;

  // Upcoming deadlines
  const upcomingDeadlines = projectsData
    ?.filter(p => p.deadline && p.status === 'active')
    ?.sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    ?.slice(0, 3) || [];

  const stats = [
    {
      title: 'Total Leads',
      value: totalLeads.toString(),
      change: totalLeads > 0 ? `${totalLeads} leads` : 'No leads yet',
      trend: 'up' as const,
      icon: Users,
      description: totalLeads > 0 ? 'in pipeline' : 'Start importing leads',
    },
    {
      title: 'Active Projects',
      value: activeProjects.toString(),
      change: `${activeProjects} active`,
      trend: 'up' as const,
      icon: FolderKanban,
      description: projectsData?.length ? `of ${projectsData.length} total` : 'No projects yet',
    },
    {
      title: 'Conversion Rate',
      value: `${conversionRate}%`,
      change: `${wonDeals} won`,
      trend: conversionRate > 20 ? 'up' as const : 'down' as const,
      icon: TrendingUp,
      description: `of ${totalLeads} leads`,
    },
    {
      title: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      change: `$${totalPaid.toLocaleString()} collected`,
      trend: 'up' as const,
      icon: DollarSign,
      description: `$${(totalRevenue - totalPaid).toLocaleString()} pending`,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500';
      case 'contacted': return 'bg-yellow-500';
      case 'in_negotiation': return 'bg-purple-500';
      case 'deal_won': return 'bg-green-500';
      case 'deal_lost': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Welcome back
              <span className="gradient-text">{user?.email?.split('@')[0] ? `, ${user.email.split('@')[0]}` : ''}!</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your agency today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadMessages && unreadMessages > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                <MessageSquare className="h-3 w-3 mr-1" />
                {unreadMessages} unread messages
              </Badge>
            )}
            <Badge variant="outline" className="capitalize">
              {role} Account
            </Badge>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card key={index} className="glass-card hover:shadow-medium transition-shadow cursor-pointer" onClick={() => {
              if (stat.title === 'Total Leads') navigate('/crm');
              else if (stat.title === 'Active Projects') navigate('/projects');
              else if (stat.title === 'Total Revenue') navigate('/finances');
            }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`flex items-center text-xs ${stat.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                    {stat.trend === 'up' ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {stat.change}
                  </span>
                  <span className="text-xs text-muted-foreground">{stat.description}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions & Activity */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Recent Activity */}
          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Recent Leads Activity
              </CardTitle>
              <CardDescription>Latest leads added to your pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              {recentLeads && recentLeads.length > 0 ? (
                <div className="space-y-3">
                  {recentLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(lead.status)}`} />
                        <div>
                          <p className="font-medium">{lead.business_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(lead.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {lead.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No leads yet. Import or add your first lead!</p>
                  <Button variant="outline" className="mt-3" onClick={() => navigate('/crm')}>
                    Go to CRM
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-accent" />
                Upcoming Deadlines
              </CardTitle>
              <CardDescription>Projects due soon</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingDeadlines.length > 0 ? (
                <div className="space-y-3">
                  {upcomingDeadlines.map((project) => (
                    <div key={project.id} className="p-3 rounded-lg bg-muted/50">
                      <p className="font-medium truncate">{project.project_name}</p>
                      <p className="text-xs text-muted-foreground">{project.client_name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="secondary" className="capitalize text-xs">
                          {project.stage?.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs font-medium text-primary">
                          {format(new Date(project.deadline!), 'MMM d')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No upcoming deadlines</p>
                </div>
              )}
              <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/projects')}>
                View All Projects
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              Financial Overview
            </CardTitle>
            <CardDescription>Quick snapshot of your agency finances</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-2xl font-bold text-blue-600">${totalPaid.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">${(totalRevenue - totalPaid).toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="text-2xl font-bold text-red-600">${totalExpenses.toLocaleString()}</p>
              </div>
            </div>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/finances')}>
              View Full Financial Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
