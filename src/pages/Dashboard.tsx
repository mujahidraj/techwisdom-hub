import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, FolderKanban, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const stats = [
  {
    title: 'Total Leads',
    value: '0',
    change: '+0%',
    trend: 'up',
    icon: Users,
    description: 'Start importing leads',
  },
  {
    title: 'Active Projects',
    value: '0',
    change: '+0%',
    trend: 'up',
    icon: FolderKanban,
    description: 'No active projects yet',
  },
  {
    title: 'Conversion Rate',
    value: '0%',
    change: '+0%',
    trend: 'up',
    icon: TrendingUp,
    description: 'Win your first deal',
  },
  {
    title: 'Revenue',
    value: '$0',
    change: '+0%',
    trend: 'up',
    icon: DollarSign,
    description: 'Close deals to track revenue',
  },
];

export default function Dashboard() {
  const { user, role } = useAuth();

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
          <Badge variant="outline" className="self-start sm:self-center capitalize">
            {role} Account
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card key={index} className="glass-card hover:shadow-medium transition-shadow">
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

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                CRM Quick Start
              </CardTitle>
              <CardDescription>
                Get started with your lead management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Import your Excel leads or add them manually to start tracking your sales pipeline.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-accent" />
                Project Operations
              </CardTitle>
              <CardDescription>
                Track your active client projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Win deals from CRM to automatically create project records with budget tracking.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}