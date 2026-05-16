import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, AlertTriangle, CheckCircle2, ListTodo, TrendingDown, Hourglass } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function TimeAudit() {

  const { data, isLoading } = useQuery({
    queryKey: ['time_productivity_audit'],
    queryFn: async () => {
      const [
        { data: projects },
        { data: updates }
      ] = await Promise.all([
        supabase.from('active_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('project_updates').select('*, project:project_id(project_name)').order('created_at', { ascending: false })
      ]);

      return {
        projects: projects || [],
        updates: updates || []
      };
    }
  });

  const stats = useMemo(() => {
    if (!data) return null;

    const completedProjects = data.projects.filter(p => p.status === 'completed');
    const activeProjects = data.projects.filter(p => p.status !== 'completed');

    // Calculate average completion time
    let totalDaysToComplete = 0;
    completedProjects.forEach(p => {
      // Assuming updated_at represents when it was completed
      totalDaysToComplete += differenceInDays(new Date(p.updated_at || p.created_at), new Date(p.created_at));
    });
    const avgDaysToComplete = completedProjects.length > 0 ? Math.round(totalDaysToComplete / completedProjects.length) : 0;

    // Identify bottlenecks (Projects stuck in the same status for > 14 days)
    const bottlenecks = activeProjects.map(p => {
      const daysSinceUpdate = differenceInDays(new Date(), new Date(p.updated_at || p.created_at));
      return { ...p, daysSinceUpdate };
    }).filter(p => p.daysSinceUpdate > 14).sort((a,b) => b.daysSinceUpdate - a.daysSinceUpdate);

    return {
      completedCount: completedProjects.length,
      activeCount: activeProjects.length,
      avgDaysToComplete,
      bottlenecks,
      totalUpdates: data.updates.length
    };
  }, [data]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Clock className="h-8 w-8 text-indigo-500" />
              Time & Productivity Audit
            </h1>
            <p className="text-muted-foreground mt-1">Identify workflow bottlenecks and track true project delivery times.</p>
          </div>
        </div>

        {isLoading || !stats ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" /> Avg Completion Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgDaysToComplete} Days</div>
                  <p className="text-xs text-muted-foreground mt-1">Average time from start to delivery</p>
                </CardContent>
              </Card>

              <Card className="glass-card border-l-4 border-l-destructive">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" /> Critical Bottlenecks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{stats.bottlenecks.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Projects stalled for over 14 days</p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Hourglass className="h-4 w-4 text-primary" /> Active Workload
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeCount} Projects</div>
                  <p className="text-xs text-muted-foreground mt-1">Currently assigned to the team</p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-indigo-500" /> Milestone Updates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUpdates}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total project updates submitted</p>
                </CardContent>
              </Card>
            </div>

            {/* Bottlenecks Warning List */}
            {stats.bottlenecks.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-destructive border-b border-destructive/20 pb-2">
                  <TrendingDown className="h-5 w-5" /> Severe Workflow Bottlenecks Detected
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.bottlenecks.map(project => (
                    <Card key={project.id} className="bg-destructive/5 border-destructive/20">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg leading-tight truncate pr-2">{project.project_name}</h3>
                          <Badge variant="destructive" className="flex-shrink-0">{project.daysSinceUpdate} Days Stalled</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Client: {project.client_name || 'Internal'}
                        </p>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Current Phase:</span>
                          <Badge variant="outline" className="capitalize">{project.status?.replace('_', ' ')}</Badge>
                        </div>
                        <div className="mt-4 pt-4 border-t border-destructive/10">
                          <p className="text-xs text-muted-foreground">
                            <strong>AI Suggestion:</strong> This project has been sitting in the '{project.status}' phase without a single update for {project.daysSinceUpdate} days. The team member assigned is likely blocked. Immediate intervention required.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Activity Feed */}
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2">
                <ListTodo className="h-5 w-5 text-indigo-500" /> Recent Productivity Log
              </h2>
              <Card className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                      <tr>
                        <th className="px-6 py-4 font-medium">Timestamp</th>
                        <th className="px-6 py-4 font-medium">Project</th>
                        <th className="px-6 py-4 font-medium">Update Phase</th>
                        <th className="px-6 py-4 font-medium">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.updates.slice(0, 15).map((update) => (
                        <tr key={update.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                            {format(new Date(update.created_at), 'MMM dd, yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {update.project?.project_name || 'Unknown Project'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="secondary">{update.title}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            {update.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.updates.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    No productivity updates logged yet.
                  </div>
                )}
              </Card>
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
