import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const mockTeam = [
  { id: 1, name: 'John Doe', role: 'Developer', email: 'john@techwisdom.com', status: 'active', salary: 5000 },
  { id: 2, name: 'Jane Smith', role: 'Designer', email: 'jane@techwisdom.com', status: 'active', salary: 4500 },
  { id: 3, name: 'Mike Johnson', role: 'Project Manager', email: 'mike@techwisdom.com', status: 'on_leave', salary: 6000 },
];

export default function Team() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const totalBurnRate = mockTeam.filter(m => m.status === 'active').reduce((sum, m) => sum + m.salary, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Team</h1>
            <p className="text-muted-foreground mt-1">Manage your team members and payroll.</p>
          </div>
          {isAdmin && (
            <Button className="gradient-primary">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>

        {isAdmin && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Team Members</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockTeam.length}</div>
                <p className="text-xs text-muted-foreground">{mockTeam.filter(m => m.status === 'active').length} active</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Monthly Burn Rate</CardTitle>
                <DollarSign className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalBurnRate.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total monthly salaries</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockTeam.map((member) => (
            <Card key={member.id} className="glass-card hover:shadow-medium transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{member.name}</h3>
                      <Badge 
                        variant={member.status === 'active' ? 'default' : 'secondary'}
                        className={member.status === 'active' ? 'bg-success' : ''}
                      >
                        {member.status === 'active' ? 'Active' : 'On Leave'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                    <p className="text-xs text-muted-foreground mt-1">{member.email}</p>
                    {isAdmin && (
                      <p className="text-sm font-medium mt-2">${member.salary.toLocaleString()}/mo</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}