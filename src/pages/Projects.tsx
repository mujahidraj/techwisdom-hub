import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const mockProjects = [
  { id: 1, name: 'Website Redesign', client: 'TechCorp Inc', stage: 4, budget: 15000, paid: 7500, status: 'active' },
  { id: 2, name: 'Mobile App Development', client: 'StartupXYZ', stage: 6, budget: 45000, paid: 30000, status: 'active' },
  { id: 3, name: 'SEO Campaign', client: 'LocalBiz', stage: 8, budget: 5000, paid: 5000, status: 'completed' },
];

const stages = ['Discovery', 'Requirement', 'Strategy', 'Design', 'Development', 'QA', 'Deployment', 'Maintenance'];

export default function Projects() {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">Track active client projects and their progress.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockProjects.filter(p => p.status === 'active').length}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${mockProjects.reduce((sum, p) => sum + p.budget, 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Collected</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${mockProjects.reduce((sum, p) => sum + p.paid, 0).toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {mockProjects.map((project) => (
            <Card key={project.id} className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>{project.client}</CardDescription>
                  </div>
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                    {project.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress: {stages[project.stage - 1]}</span>
                    <span>{Math.round((project.stage / 8) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full gradient-primary rounded-full transition-all" 
                      style={{ width: `${(project.stage / 8) * 100}%` }} 
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Budget: ${project.budget.toLocaleString()}</span>
                  <span className="text-success">Paid: ${project.paid.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {mockProjects.length === 0 && (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No projects yet. Win deals from CRM to create projects.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}