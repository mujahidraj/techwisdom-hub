import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Building2,
  FolderKanban,
  Clock,
  CheckCircle2,
  LogOut,
  MessageSquare,
  Calendar,
  DollarSign,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Tables, Database } from '@/integrations/supabase/types';

type Project = Tables<'active_projects'>;
type ProjectUpdate = Tables<'project_updates'>;
type Invoice = Tables<'invoices'>;
type ProjectStage = Database['public']['Enums']['project_stage'];

const stages: ProjectStage[] = [
  'discovery',
  'requirement',
  'strategy',
  'design',
  'development',
  'qa',
  'deployment',
  'maintenance',
];

const stageLabels: Record<ProjectStage, string> = {
  discovery: 'Discovery',
  requirement: 'Requirement',
  strategy: 'Strategy',
  design: 'Design',
  development: 'Development',
  qa: 'QA',
  deployment: 'Deployment',
  maintenance: 'Maintenance',
};

export default function ClientPortal() {
  const navigate = useNavigate();
  const { user, role, signOut, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || role !== 'client')) {
      navigate('/auth');
    }
  }, [user, role, loading, navigate]);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['client-projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_projects')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user,
  });

  const { data: updates = [] } = useQuery({
    queryKey: ['client-updates', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase
        .from('project_updates')
        .select('*')
        .in('project_id', projects.map(p => p.id))
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as ProjectUpdate[];
    },
    enabled: projects.length > 0,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['client-invoices', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .in('project_id', projects.map(p => p.id))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: projects.length > 0,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getProgress = (stage: ProjectStage) => ((stages.indexOf(stage) + 1) / stages.length) * 100;

  if (loading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_budget), 0);
  const totalPaid = projects.reduce((sum, p) => sum + Number(p.paid_amount), 0);
  const pendingAmount = totalBudget - totalPaid;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 gradient-primary rounded-lg">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-lg">TechWisdom</span>
              <p className="text-xs text-muted-foreground">Client Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Welcome to Your Portal</h1>
          <p className="text-muted-foreground mt-1">Track your projects, view updates, and manage invoices.</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.filter(p => p.status === 'active').length}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalBudget.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Amount Paid</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">${totalPaid.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">${pendingAmount.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Projects List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold">Your Projects</h2>
            {projects.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-12 text-center">
                  <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No projects assigned yet.</p>
                </CardContent>
              </Card>
            ) : (
              projects.map((project) => (
                <Card key={project.id} className="glass-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{project.project_name}</CardTitle>
                        <CardDescription>{project.project_type}</CardDescription>
                      </div>
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stage Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">{stageLabels[project.stage]}</span>
                        <span className="text-muted-foreground">
                          Stage {stages.indexOf(project.stage) + 1} of {stages.length}
                        </span>
                      </div>
                      <Progress value={getProgress(project.stage)} className="h-2" />
                    </div>

                    {/* Stage Steps */}
                    <div className="flex justify-between text-xs">
                      {stages.map((stage, idx) => (
                        <div
                          key={stage}
                          className={`flex flex-col items-center ${
                            idx <= stages.indexOf(project.stage)
                              ? 'text-primary'
                              : 'text-muted-foreground'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 rounded-full ${
                              idx <= stages.indexOf(project.stage)
                                ? 'bg-primary'
                                : 'bg-muted'
                            }`}
                          />
                          <span className="mt-1 hidden md:block">{stageLabels[stage]}</span>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Budget Info */}
                    <div className="flex justify-between text-sm">
                      <span>Budget: ${Number(project.total_budget).toLocaleString()}</span>
                      <span className="text-success">Paid: ${Number(project.paid_amount).toLocaleString()}</span>
                    </div>

                    {project.deadline && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Deadline: {format(new Date(project.deadline), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Updates */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Recent Updates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {updates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No updates yet.</p>
                ) : (
                  updates.slice(0, 5).map((update) => (
                    <div key={update.id} className="border-l-2 border-primary pl-3 py-1">
                      <p className="font-medium text-sm">{update.title}</p>
                      <p className="text-xs text-muted-foreground">{update.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(update.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Invoices */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No invoices yet.</p>
                ) : (
                  invoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          ${Number(invoice.amount).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant={invoice.status === 'paid' ? 'default' : 'outline'}
                        className="capitalize"
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}