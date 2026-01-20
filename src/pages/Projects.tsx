import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Added Import
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
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
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
  const navigate = useNavigate(); // Added Hook
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [completeProject, setCompleteProject] = useState<Project | null>(null);

  // --- NEW STATE FOR FEATURES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'budget' | 'progress'>('date');

  // Fetch only active projects (hide completed)
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_projects')
        .select('*')
        .neq('status', 'completed')
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

  // --- NEW: Filter and Sort Logic ---
  const filteredProjects = projects
    .filter(p => 
      p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.client_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'budget') return Number(b.total_budget) - Number(a.total_budget);
      if (sortBy === 'progress') return getProgress(b.stage) - getProgress(a.stage);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Default 'date'
    });

  // --- NEW: Export Functionality ---
  const handleExportCSV = () => {
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
              Track active client projects. Completed projects move to Portfolio.
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
              <Button className="gradient-primary" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </div>
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
              <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Collected</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
            </CardContent>
          </Card>
        </div>

        {/* --- NEW: Filters and Toolbar --- */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/30 p-3 rounded-lg border">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search projects..." 
                className="pl-9 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Sort By">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setSortBy('date')}>Sort by Date (Newest)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('budget')}>Sort by Budget (High)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('progress')}>Sort by Progress</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center bg-background rounded-md border p-1">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className={viewMode === 'grid' ? "space-y-4" : "grid gap-4"}>
          {filteredProjects.map((project) => (
            viewMode === 'grid' ? (
              // --- GRID CARD VIEW ---
              <Card 
                key={project.id} 
                className="glass-card group cursor-pointer hover:shadow-md transition-all"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
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
                              onClick={(e) => e.stopPropagation()} // Stop propagation
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditProject(project); }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCompleteProject(project); }}>
                              <Archive className="h-4 w-4 mr-2" />
                              Mark Complete
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setDeleteProject(project); }}
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
                  <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
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
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3" onClick={(e) => e.stopPropagation()}>
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
                    <div className="p-4 bg-muted/50 rounded-lg" onClick={(e) => e.stopPropagation()}>
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

                  {/* Documents Section */}
                  {isAdmin && (
                    <div className="pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between"
                        onClick={(e) => {
                          e.stopPropagation(); // Stop propagation here too
                          setExpandedProject(
                            expandedProject === project.id ? null : project.id
                          )
                        }}
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
                        <div className="mt-3 p-4 bg-muted/30 rounded-lg" onClick={(e) => e.stopPropagation()}>
                          <ProjectDocuments projectId={project.id} isAdmin={isAdmin} />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              // --- NEW: LIST VIEW ---
              <Card 
                key={project.id} 
                className="hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold text-base">{project.project_name}</div>
                    <div className="text-sm text-muted-foreground">{project.client_name}</div>
                  </div>
                  
                  <div className="hidden md:block min-w-[120px]">
                    <div className="text-xs text-muted-foreground uppercase mb-1">Stage</div>
                    <Badge variant="outline">{stageLabels[project.stage]}</Badge>
                  </div>

                  <div className="hidden sm:block min-w-[150px]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Progress</span>
                      <span>{Math.round(getProgress(project.stage))}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full w-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${getProgress(project.stage)}%` }} />
                    </div>
                  </div>

                  <div className="hidden lg:block text-right min-w-[100px]">
                    <div className="font-medium text-sm">${Number(project.total_budget).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Budget</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()} // Stop propagation
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditProject(project); }}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCompleteProject(project); }}>
                            <Archive className="h-4 w-4 mr-2" /> Mark Complete
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteProject(project); }}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </Card>
            )
          ))}

          {filteredProjects.length === 0 && (
            <Card className="glass-card col-span-full">
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No projects matching your search.
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

      {/* Mark Complete Dialog */}
      <AlertDialog open={!!completeProject} onOpenChange={(open) => !open && setCompleteProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Portfolio?</AlertDialogTitle>
            <AlertDialogDescription>
              Marking "{completeProject?.project_name}" as complete will:
              <ul className="list-disc list-inside mt-2">
                <li>Mark the project as "Completed" in the database.</li>
                <li><strong>Automatically create a new Portfolio item</strong> in the CMS.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => completeProject && completeMutation.mutate(completeProject)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirm Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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