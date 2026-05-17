import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  FolderKanban,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Archive,
  Search,
  LayoutGrid,
  LayoutList,
  ArrowUpDown,
  Download,
  Coins,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useActivityLog } from '@/hooks/useActivityLog';
import { AddProjectDialog } from '@/components/projects/AddProjectDialog';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';
import { ProjectDocuments } from '@/components/projects/ProjectDocuments';
import { formatCurrency } from '@/lib/currency';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Tables, Database } from '@/integrations/supabase/types';

type Project = Tables<'active_projects'>;
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

export default function Projects() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const { sendNotification } = useNotifications();
  const { logActivity, logSecurity } = useActivityLog();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [completeProject, setCompleteProject] = useState<Project | null>(null);

  // --- FILTER & SORT STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'budget' | 'progress'>('date');

  // Fetch only active projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', role, user?.id],
    queryFn: async () => {
      // If employee, first fetch their assignment IDs!
      if (role === 'employee') {
        const { data: empRecord } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (!empRecord) return [];

        const { data: assignments } = await (supabase
          .from('project_assignments' as any)
          .select('project_id')
          .eq('employee_id', empRecord.id) as any);

        if (!assignments || assignments.length === 0) return [];
        const projectIds = assignments.map((a: any) => a.project_id);

        const { data, error } = await supabase
          .from('active_projects')
          .select('*')
          .in('id', projectIds)
          .neq('status', 'completed')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Project[];
      }

      // If client, fetch their specific projects
      if (role === 'client') {
        const { data, error } = await supabase
          .from('active_projects')
          .select('*')
          .eq('client_id', user?.id)
          .neq('status', 'completed')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Project[];
      }

      // Admin or other role: fetch all active projects
      const { data, error } = await supabase
        .from('active_projects')
        .select('*')
        .neq('status', 'completed')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!role && !!user?.id
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Project>;
    }) => {
      const { error } = await supabase.from('active_projects').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (variables.updates.stage) {
        logActivity('updated', 'project', `Moved project to ${stageLabels[variables.updates.stage]} stage`, variables.id);
        logSecurity('UPDATE', 'PROJECT', `Changed project stage to ${stageLabels[variables.updates.stage]}`, variables.id);
      } else {
        logActivity('updated', 'project', 'Updated project properties', variables.id);
        logSecurity('UPDATE', 'PROJECT', 'Updated project properties', variables.id);
      }
    },
    onError: (error) => {
      toast.error('Failed to update project: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('active_projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (deleteProject) {
        logActivity('deleted', 'project', deleteProject.project_name, deleteProject.id);
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
      setDeleteProject(null);
    },
    onError: (error) => {
      toast.error('Failed to delete project: ' + error.message);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (project: Project) => {
      const { error: updateError } = await supabase
        .from('active_projects')
        .update({ status: 'completed' })
        .eq('id', project.id);
      
      if (updateError) throw updateError;

      const { error: insertError } = await supabase
        .from('portfolio')
        .insert({
          title: project.project_name,
          category: project.project_type,
          description: `Completed project for client: ${project.client_name}.`,
          created_by: user?.id,
          featured: false
        });

      if (insertError) {
        console.error("Portfolio creation failed:", insertError);
        toast.warning("Project completed, but failed to copy to Portfolio.");
      }
    },
    onSuccess: () => {
      if (completeProject) {
        logActivity('completed', 'project', completeProject.project_name, completeProject.id);
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success("Project completed and moved to Portfolio!");
      setCompleteProject(null);
    },
    onError: (error) => {
      toast.error('Failed to complete project: ' + error.message);
    }
  });

  const handleStageChange = (project: Project, stage: ProjectStage) => {
    updateMutation.mutate({ id: project.id, updates: { stage } });
    logActivity('updated', 'project', `${project.project_name} to ${stageLabels[stage]} Stage`, project.id, { stage });
    
    if (project.client_id) {
      sendNotification({
        userId: project.client_id,
        title: 'Project Update',
        message: `Your project "${project.project_name}" has moved to the ${stageLabels[stage]} stage.`,
        type: 'success',
        actionLink: `/client-portal`
      });
    }

    toast.success(`Project moved to ${stageLabels[stage]}`);
  };

  const handleChecklistChange = (
    project: Project,
    field: 'domain_purchased' | 'ssl_active' | 'credentials_sent' | 'retainer_paid',
    value: boolean
  ) => {
    updateMutation.mutate({ id: project.id, updates: { [field]: value } });
    logActivity('updated', 'project', `${field.replace('_', ' ')} ${value ? 'enabled' : 'disabled'} for ${project.project_name}`, project.id, { field, value });
  };

  const getStageIndex = (stage: ProjectStage) => stages.indexOf(stage);
  const getProgress = (stage: ProjectStage) => ((getStageIndex(stage) + 1) / stages.length) * 100;

  // Filter and Sort
  const filteredProjects = projects
    .filter(p => 
      p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.client_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'budget') return Number(b.total_budget) - Number(a.total_budget);
      if (sortBy === 'progress') return getProgress(b.stage) - getProgress(a.stage);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const handleExportCSV = () => {
    logSecurity('EXPORT', 'PROJECT', 'Exported active projects list to CSV format');
    const headers = ["Project Name", "Client", "Type", "Stage", "Budget", "Paid", "Status"];
    const rows = filteredProjects.map(p => [
      p.project_name,
      p.client_name,
      p.project_type,
      stageLabels[p.stage],
      p.total_budget,
      p.paid_amount,
      p.status
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "active_projects.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeProjects = projects.filter((p) => p.status === 'active');
  const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_budget), 0);
  const totalPaid = projects.reduce((sum, p) => sum + Number(p.paid_amount), 0);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[400px] items-center justify-center bg-white dark:bg-slate-950">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Synchronizing Projects...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in pb-10">
        
        {/* HEADER AREA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                <FolderKanban className="h-5 w-5 text-white" />
              </div>
              Projects Engine
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Track real-time production, stages, deployments, and financial lifecycles.
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3 shrink-0">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9 rounded-xl text-xs gap-2 border-border/60 hover:bg-muted/50">
                <Download className="h-3.5 w-3.5" /> Export Data
              </Button>
              <Button className="gradient-primary shadow-lg shadow-primary/25 h-9 rounded-xl text-xs" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> New Project
              </Button>
            </div>
          )}
        </div>

        {/* METRICS GRID */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[
            { label: 'Active Projects', value: activeProjects.length, sub: 'In pipeline', icon: FolderKanban, color: 'from-violet-500 to-purple-600 shadow-violet-500/10' },
            ...(role !== 'employee' ? [
              { label: 'Total Value', value: formatCurrency(totalBudget), sub: 'Contract book', icon: Coins, color: 'from-amber-500 to-orange-600 shadow-amber-500/10' },
              { label: 'Total Collected', value: formatCurrency(totalPaid), sub: 'Financial progress', icon: CheckCircle2, color: 'from-emerald-500 to-green-600 shadow-emerald-500/10' },
            ] : [])
          ].map((metric, i) => (
            <Card key={i} className={`glass-card group hover:shadow-lg transition-all duration-300 relative overflow-hidden ${role === 'employee' ? 'col-span-full' : ''}`}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{metric.label}</p>
                  <p className="text-2xl font-black mt-2 tracking-tight">{metric.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{metric.sub}</p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${metric.color} shadow-lg text-white shrink-0 group-hover:scale-110 transition-transform`}>
                  <metric.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* TOOLBAR & FILTERS */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-border/40 shadow-sm">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search by client or project name..." 
                className="pl-9 h-9 bg-muted/30 text-xs rounded-xl border-border/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs gap-1.5 border-border/50 bg-background/50">
                  <ArrowUpDown className="h-3.5 w-3.5" /> Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 rounded-xl p-1.5">
                <DropdownMenuItem onClick={() => setSortBy('date')} className="rounded-lg text-xs py-2 font-medium">Date Created</DropdownMenuItem>
                {role !== 'employee' && (
                  <DropdownMenuItem onClick={() => setSortBy('budget')} className="rounded-lg text-xs py-2 font-medium">Contract Budget</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setSortBy('progress')} className="rounded-lg text-xs py-2 font-medium">Development Progress</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center bg-muted/40 rounded-xl border border-border/40 p-1 self-stretch md:self-auto justify-center">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`h-8 px-3 rounded-lg text-xs gap-1.5 transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-950 shadow-sm font-semibold' : 'text-muted-foreground'}`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`h-8 px-3 rounded-lg text-xs gap-1.5 transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-950 shadow-sm font-semibold' : 'text-muted-foreground'}`}
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-3.5 w-3.5" /> List
            </Button>
          </div>
        </div>

        {/* PROJECTS CONTAINER */}
        <div className={viewMode === 'grid' ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "space-y-4"}>
          {filteredProjects.map((project, index) => {
            const progress = getProgress(project.stage);
            const isCompleted = project.status === 'completed';

            return viewMode === 'grid' ? (
              // ══════════════════ REDESIGNED GRID CARD ══════════════════
              <Card 
                key={project.id} 
                className="glass-card group flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative border-border/40 overflow-hidden"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                {/* Visual Accent Top Bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80" />

                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black tracking-widest text-primary uppercase">{project.project_type}</span>
                      <CardTitle className="text-base font-bold mt-1 text-slate-900 dark:text-white line-clamp-1 leading-snug">
                        {project.project_name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1 text-muted-foreground font-medium flex items-center gap-1.5">
                        <span className="truncate">{project.client_name}</span>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg border border-border/30 bg-muted/10 opacity-0 group-hover:opacity-100 transition-all hover:bg-muted"
                            >
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                            <DropdownMenuItem onClick={() => setEditProject(project)} className="rounded-lg text-xs py-2 gap-2">
                              <Edit className="h-3.5 w-3.5" /> Edit Project
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCompleteProject(project)} className="rounded-lg text-xs py-2 gap-2 text-emerald-600 focus:text-emerald-600">
                              <Archive className="h-3.5 w-3.5" /> Mark Completed
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteProject(project)}
                              className="rounded-lg text-xs py-2 gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete Project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-between space-y-5">
                  {/* Selector / Label */}
                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs font-semibold text-muted-foreground">Status / Stage:</span>
                    {(isAdmin || role === 'employee') ? (
                      <Select
                        value={project.stage}
                        onValueChange={(value) => handleStageChange(project, value as ProjectStage)}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs rounded-lg border-border/40 font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {stages.map((stage) => (
                            <SelectItem key={stage} value={stage} className="text-xs py-2">
                              {stageLabels[stage]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="capitalize text-[10px] py-0.5 font-bold">
                        {stageLabels[project.stage]}
                      </Badge>
                    )}
                  </div>

                  {/* Progressive Meter */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      <span>Production Timeline</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-muted dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-border/10">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 shadow-sm"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Checklist (Deployment) */}
                  {project.stage === 'deployment' && isAdmin && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-border/30 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                      <h4 className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Deployment Check</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { key: 'domain_purchased', label: 'Domain Config' },
                          { key: 'ssl_active', label: 'SSL Active' },
                          { key: 'credentials_sent', label: 'Handover Docs' }
                        ].map((chk) => (
                          <div key={chk.key} className="flex items-center space-x-2.5">
                            <Checkbox
                              id={`chk-${chk.key}-${project.id}`}
                              checked={!!(project as any)[chk.key]}
                              onCheckedChange={(checked) =>
                                handleChecklistChange(project, chk.key as any, checked as boolean)
                              }
                              className="rounded h-4 w-4 border-border/60"
                            />
                            <label htmlFor={`chk-${chk.key}-${project.id}`} className="text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
                              {chk.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Retainer (Maintenance) */}
                  {project.stage === 'maintenance' && isAdmin && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-border/30" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`ret-${project.id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Retainer Paid
                        </Label>
                        <Switch
                          id={`ret-${project.id}`}
                          checked={project.retainer_paid || false}
                          onCheckedChange={(checked) =>
                            handleChecklistChange(project, 'retainer_paid', checked)
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Ledger strip */}
                  {role !== 'employee' && (
                    <div className="flex justify-between items-center text-xs pt-3 border-t border-border/30 mt-auto">
                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase font-bold">Ledger Budget</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ৳{Number(project.total_budget).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block uppercase font-bold">Cleared</span>
                        <span className="font-black text-emerald-600">
                          ৳{Number(project.paid_amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Docs Accordion */}
                  {isAdmin && (
                    <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between h-8 rounded-lg hover:bg-muted text-xs font-semibold px-2 text-muted-foreground"
                        onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-indigo-500" /> Documents Folder
                        </span>
                        {expandedProject === project.id ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {expandedProject === project.id && (
                        <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-border/20 max-h-[160px] overflow-y-auto sidebar-scroll">
                          <ProjectDocuments projectId={project.id} isAdmin={isAdmin} />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              // ══════════════════ REDESIGNED LIST CARD ══════════════════
              <Card 
                key={project.id} 
                className="group border border-border/40 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden relative"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                {/* Tiny left edge strip */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-600" />
                
                <div className="p-4 pl-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <span className="text-[9px] font-black uppercase text-primary tracking-widest">{project.project_type}</span>
                    <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">{project.project_name}</div>
                    <div className="text-xs text-muted-foreground font-medium">{project.client_name}</div>
                  </div>
                  
                  <div className="hidden md:block min-w-[120px]">
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider mb-1">Current Stage</span>
                    <Badge variant="outline" className="text-xs font-semibold rounded-lg">{stageLabels[project.stage]}</Badge>
                  </div>

                  <div className="hidden sm:block min-w-[140px]">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      <span>Timeline Status</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full w-full overflow-hidden p-0.5">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {role !== 'employee' && (
                    <div className="hidden lg:block text-right min-w-[120px]">
                      <div className="font-black text-sm text-slate-900 dark:text-white">৳{Number(project.total_budget).toLocaleString()}</div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Book Value</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg border border-border/30 bg-muted/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                          <DropdownMenuItem onClick={() => setEditProject(project)} className="rounded-lg text-xs py-2 gap-2">
                            <Edit className="h-3.5 w-3.5" /> Edit Project
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCompleteProject(project)} className="rounded-lg text-xs py-2 gap-2 text-emerald-600 focus:text-emerald-600">
                            <Archive className="h-3.5 w-3.5" /> Mark Completed
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteProject(project)} className="rounded-lg text-xs py-2 gap-2 text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" /> Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {filteredProjects.length === 0 && (
            <Card className="glass-card col-span-full">
              <CardContent className="py-16 text-center">
                <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-semibold text-sm">No projects matched search criteria</p>
                <p className="text-xs text-muted-foreground mt-1">Refine your search term or filters.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Project Dialog */}
      <AddProjectDialog open={addOpen} onOpenChange={setAddOpen} />

      {/* Edit Project Dialog */}
      <EditProjectDialog
        project={editProject}
        onOpenChange={(open) => !open && setEditProject(null)}
      />

      {/* Mark Complete Confirmation */}
      <AlertDialog open={!!completeProject} onOpenChange={(open) => !open && setCompleteProject(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-emerald-500" /> Move to Portfolio?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed mt-2">
              Marking "{completeProject?.project_name}" as complete will:
              <ul className="list-disc list-inside mt-2 space-y-1 font-semibold text-slate-700 dark:text-slate-300">
                <li>Mark the project as "Completed" in the active list.</li>
                <li>Automatically generate a Portfolio showcase item.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl text-xs h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => completeProject && completeMutation.mutate(completeProject)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9"
            >
              Confirm Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProject} onOpenChange={(open) => !open && setDeleteProject(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Project
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs mt-2">
              Are you sure you want to delete "{deleteProject?.project_name}"? This action is permanent and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl text-xs h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProject && deleteMutation.mutate(deleteProject.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/95 rounded-xl text-xs h-9"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}