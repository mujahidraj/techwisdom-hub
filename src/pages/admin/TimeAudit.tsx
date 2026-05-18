import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ListTodo,
  TrendingDown,
  Hourglass,
  Calendar,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function TimeAudit() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['time_productivity_audit'],
    queryFn: async () => {
      // Fetch projects & updates
      let [
        { data: projects },
        { data: updates }
      ] = await Promise.all([
        supabase.from('active_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('project_updates').select('*, project:project_id(project_name)').order('created_at', { ascending: false })
      ]);

      let projectsList = projects || [];
      let updatesList = updates || [];

      // Auto-seed active_projects if empty
      // Auto-seed project_updates if empty

      return {
        projects: projectsList,
        updates: updatesList
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
      totalDaysToComplete += differenceInDays(new Date(p.updated_at || p.created_at), new Date(p.created_at));
    });
    const avgDaysToComplete = completedProjects.length > 0 ? Math.round(totalDaysToComplete / completedProjects.length) : 0;

    // Identify bottlenecks (Projects stuck in the same status for > 14 days)
    const bottlenecks = activeProjects.map(p => {
      const daysSinceUpdate = differenceInDays(new Date(), new Date(p.updated_at || p.created_at));
      return { ...p, daysSinceUpdate };
    }).filter(p => p.daysSinceUpdate > 14).sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

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
      <div className="space-y-6 animate-fade-in pb-10 flex flex-col lg:h-[calc(100vh-120px)] min-h-0 lg:overflow-hidden">

        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 dark:bg-slate-900/60 border border-border/60 backdrop-blur-xl p-5 rounded-2xl shadow-xl shadow-slate-100/30 dark:shadow-none shrink-0">
          <div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
              <Clock className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-500 animate-pulse" />
              Time & Delivery Bottleneck Audit
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Live workflow monitoring: Automatically identify team blocks, project updates frequency, and average lifecycle durations.
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="h-10 rounded-xl font-bold border-border/60 hover:bg-slate-50 dark:hover:bg-slate-950/20 text-slate-700 dark:text-slate-355 w-full sm:w-auto justify-center"
          >
            Refetch Logs
          </Button>
        </div>

        {/* METRICS COUNT STRIP */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-lg rounded-2xl">
              <CardContent className="p-4 sm:p-4.5 flex items-center gap-3 sm:gap-3.5">
                <div className="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-xl shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="truncate">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Completion</p>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 truncate">{stats.avgDaysToComplete} Days</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-lg rounded-2xl">
              <CardContent className="p-4 sm:p-4.5 flex items-center gap-3 sm:gap-3.5 text-destructive">
                <div className="p-2.5 sm:p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-xl shrink-0">
                  <AlertTriangle className="h-5 w-5 animate-pulse" />
                </div>
                <div className="truncate">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Critical Bottlenecks</p>
                  <h3 className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-455 truncate">{stats.bottlenecks.length} Stallers</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-lg rounded-2xl">
              <CardContent className="p-4 sm:p-4.5 flex items-center gap-3 sm:gap-3.5">
                <div className="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 rounded-xl shrink-0">
                  <Hourglass className="h-5 w-5" />
                </div>
                <div className="truncate">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Workload</p>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 truncate">{stats.activeCount} Projects</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-lg rounded-2xl">
              <CardContent className="p-4 sm:p-4.5 flex items-center gap-3 sm:gap-3.5">
                <div className="p-2.5 sm:p-3 bg-purple-50 dark:bg-purple-950/20 text-purple-500 rounded-xl shrink-0">
                  <ListTodo className="h-5 w-5" />
                </div>
                <div className="truncate">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Milestone Logs</p>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 truncate">{stats.totalUpdates} Updates</h3>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* LOADING INDICATOR */}
        {isLoading || !stats ? (
          <div className="flex flex-col items-center justify-center flex-1 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-slate-400">Processing lifecycle data...</p>
          </div>
        ) : (

          /* SPLITindependent VIEWPORT WORKSPACE */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 lg:overflow-hidden">

            {/* COLUMN 1: WORKFLOW BOTTLENECKS */}
            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl flex flex-col min-h-0 lg:overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40 shrink-0 bg-slate-50/50 dark:bg-slate-950/10">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <TrendingDown className="h-5 w-5 text-rose-500" />
                  Stalled Delivery Radar
                </CardTitle>
                <CardDescription className="text-xs">
                  Active projects with no milestone changes or updates for over 14 days.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 flex-1 lg:overflow-y-auto min-h-0 scrollbar-none space-y-4">
                {stats.bottlenecks.length === 0 ? (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 rounded-xl p-6 text-center flex flex-col items-center justify-center h-48 font-semibold text-xs">
                    <ShieldCheck className="h-10 w-10 text-emerald-500 mb-2.5" />
                    Delivery is moving perfectly.
                    <span className="text-[10px] text-slate-450 mt-1">No stalled project blockers detected!</span>
                  </div>
                ) : (
                  stats.bottlenecks.map((project) => (
                    <div key={project.id} className="border border-destructive/20 bg-destructive/5 rounded-xl p-4 relative overflow-hidden transition-all duration-150 hover:scale-[0.99]">
                      <div className="absolute top-0 bottom-0 left-0 w-1 bg-destructive" />

                      <div className="flex justify-between items-start mb-2 pl-1.5">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 leading-tight">
                            {project.project_name}
                          </h4>
                          <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">
                            Client: <span className="text-slate-600 dark:text-slate-350">{project.client_name || 'Internal'}</span>
                          </p>
                        </div>
                        <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none font-black text-2xs px-2 py-0.5 rounded-lg select-none">
                          {project.daysSinceUpdate} Days Stalled
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-2xs font-bold text-slate-450 uppercase mb-3 pl-1.5">
                        <span>Current Stage:</span>
                        <Badge variant="outline" className="text-2xs font-extrabold py-0.5 uppercase tracking-wide bg-background/50 border-border/40 select-none">
                          {project.stage?.replace('_', ' ') || 'Discovery'}
                        </Badge>
                      </div>

                      <div className="bg-white dark:bg-slate-950/45 p-3 rounded-lg border border-border/40 text-2xs leading-relaxed">
                        <div className="flex items-center gap-1 font-bold text-slate-450 uppercase tracking-wider mb-1">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                          Delivery Blocker Analysis
                        </div>
                        <p className="text-slate-500 dark:text-slate-350 font-semibold leading-relaxed">
                          This project is currently sitting in the <strong className="text-primary uppercase font-mono">'{project.stage}'</strong> stage without a single progress log or status transition in over two weeks. Team member blockages or budget scopes mismatch are highly likely. Escalation suggested.
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* COLUMN 2: RECENT PRODUCTIVITY LOG */}
            <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl flex flex-col min-h-0 lg:overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40 shrink-0 bg-slate-50/50 dark:bg-slate-950/10">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <ListTodo className="h-5 w-5 text-indigo-500" />
                  Milestone Productivity Log
                </CardTitle>
                <CardDescription className="text-xs">
                  Unified history stream of all submitted project milestone reports.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 flex-1 lg:overflow-y-auto min-h-0 scrollbar-none">
                {data.updates.length === 0 ? (
                  <div className="bg-slate-500/5 border border-slate-500/20 text-slate-500 rounded-xl p-6 text-center flex flex-col items-center justify-center h-48 font-semibold text-xs">
                    <Calendar className="h-10 w-10 text-slate-400 mb-2.5" />
                    No milestones reported.
                    <span className="text-[10px] text-slate-455 mt-1">Logs will appear as team members record project progress.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-border/40 rounded-xl bg-white/30 dark:bg-slate-950/20 w-full">
                    <table className="w-full text-sm text-left table-fixed min-w-[600px]">
                      <thead className="text-[10px] text-slate-455 uppercase bg-slate-50/75 dark:bg-slate-950/30 border-b border-border/40 sticky top-0 backdrop-blur-md z-10">
                        <tr>
                          <th className="px-4 py-3 font-black tracking-wider w-[20%]">Date</th>
                          <th className="px-4 py-3 font-black tracking-wider w-[28%]">Project Name</th>
                          <th className="px-4 py-3 font-black tracking-wider w-[22%]">Milestone</th>
                          <th className="px-4 py-3 font-black tracking-wider w-[30%]">Report Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {data.updates.slice(0, 30).map((update) => (
                          <tr key={update.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors duration-150">
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-550 font-semibold truncate">
                              {format(new Date(update.created_at), 'MMM dd, HH:mm')}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-bold text-slate-800 dark:text-slate-200">
                              <span className="truncate block max-w-full" title={update.project?.project_name}>
                                {update.project?.project_name || 'Unknown Project'}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold text-2xs px-2 py-0.5 rounded-lg select-none truncate block text-center max-w-full">
                                {update.title}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-350 break-words whitespace-normal leading-relaxed">
                              {update.message}
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
