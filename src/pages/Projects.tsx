import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AddProjectDialog } from '@/components/projects/AddProjectDialog';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';
import { ProjectDocuments } from '@/components/projects/ProjectDocuments';
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
type ProjectStatus = Database['public']['Enums']['project_status'];

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
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
      setDeleteProject(null);
    },
    onError: (error) => {
      toast.error('Failed to delete project: ' + error.message);
    },
  });

  const handleStageChange = (project: Project, stage: ProjectStage) => {
    updateMutation.mutate({ id: project.id, updates: { stage } });
    toast.success(`Project moved to ${stageLabels[stage]}`);
  };

  const handleChecklistChange = (
    project: Project,
    field: 'domain_purchased' | 'ssl_active' | 'credentials_sent' | 'retainer_paid',
    value: boolean
  ) => {
    updateMutation.mutate({ id: project.id, updates: { [field]: value } });
  };

  const getStageIndex = (stage: ProjectStage) => stages.indexOf(stage);
  const getProgress = (stage: ProjectStage) => ((getStageIndex(stage) + 1) / stages.length) * 100;

  const activeProjects = projects.filter((p) => p.status === 'active');
  const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_budget), 0);
  const totalPaid = projects.reduce((sum, p) => sum + Number(p.paid_amount), 0);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading projects...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Track active client projects and their progress.
            </p>
          </div>
          {isAdmin && (
            <Button className="gradient-primary" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProjects.length}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalBudget.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Collected</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalPaid.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {projects.map((project) => (
            <Card key={project.id} className="glass-card group">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{project.project_name}</CardTitle>
                    <CardDescription>
                      {project.client_name} • {project.project_type}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={project.status === 'active' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {project.status}
                    </Badge>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditProject(project)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteProject(project)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stage Selector */}
                <div className="flex items-center gap-4">
                  <Label className="text-sm text-muted-foreground min-w-[60px]">Stage:</Label>
                  {isAdmin ? (
                    <Select
                      value={project.stage}
                      onValueChange={(value) => handleStageChange(project, value as ProjectStage)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {stageLabels[stage]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="font-medium">{stageLabels[project.stage]}</span>
                  )}
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span>{Math.round(getProgress(project.stage))}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-primary rounded-full transition-all"
                      style={{ width: `${getProgress(project.stage)}%` }}
                    />
                  </div>
                </div>

                {/* Deployment Checklist */}
                {project.stage === 'deployment' && isAdmin && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <h4 className="font-medium text-sm">Deployment Checklist</h4>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`domain-${project.id}`}
                        checked={project.domain_purchased || false}
                        onCheckedChange={(checked) =>
                          handleChecklistChange(project, 'domain_purchased', checked as boolean)
                        }
                      />
                      <label htmlFor={`domain-${project.id}`} className="text-sm">
                        Domain Purchased
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`ssl-${project.id}`}
                        checked={project.ssl_active || false}
                        onCheckedChange={(checked) =>
                          handleChecklistChange(project, 'ssl_active', checked as boolean)
                        }
                      />
                      <label htmlFor={`ssl-${project.id}`} className="text-sm">
                        SSL Active
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`credentials-${project.id}`}
                        checked={project.credentials_sent || false}
                        onCheckedChange={(checked) =>
                          handleChecklistChange(project, 'credentials_sent', checked as boolean)
                        }
                      />
                      <label htmlFor={`credentials-${project.id}`} className="text-sm">
                        Credentials Sent
                      </label>
                    </div>
                  </div>
                )}

                {/* Maintenance Retainer */}
                {project.stage === 'maintenance' && isAdmin && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`retainer-${project.id}`} className="text-sm font-medium">
                        Retainer Paid?
                      </Label>
                      <Switch
                        id={`retainer-${project.id}`}
                        checked={project.retainer_paid || false}
                        onCheckedChange={(checked) =>
                          handleChecklistChange(project, 'retainer_paid', checked)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Budget Info */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Budget: ${Number(project.total_budget).toLocaleString()}
                  </span>
                  <span className="text-success">
                    Paid: ${Number(project.paid_amount).toLocaleString()}
                  </span>
                </div>

                {/* Documents Section (Expandable) */}
                {isAdmin && (
                  <div className="pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => setExpandedProject(
                        expandedProject === project.id ? null : project.id
                      )}
                    >
                      <span className="flex items-center gap-2">
                        Documents
                      </span>
                      {expandedProject === project.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    {expandedProject === project.id && (
                      <div className="mt-3 p-4 bg-muted/30 rounded-lg">
                        <ProjectDocuments projectId={project.id} isAdmin={isAdmin} />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {projects.length === 0 && (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No projects yet. Win deals from CRM to create projects.
                </p>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProject} onOpenChange={(open) => !open && setDeleteProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteProject?.project_name}"? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProject && deleteMutation.mutate(deleteProject.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
