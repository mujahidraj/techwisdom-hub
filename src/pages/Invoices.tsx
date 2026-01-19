import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, Sparkles } from 'lucide-react';

const eligibleProjects = [
  { id: 1, name: 'Website Redesign', client: 'TechCorp Inc', amount: 7500, status: 'pending' },
  { id: 2, name: 'Mobile App Development', client: 'StartupXYZ', amount: 15000, status: 'pending' },
];

export default function Invoices() {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage client invoices and payments.</p>
        </div>

        <Card className="glass-card overflow-hidden">
          <div className="gradient-primary p-8 text-center text-primary-foreground">
            <Sparkles className="h-16 w-16 mx-auto mb-4 opacity-80" />
            <h2 className="text-2xl font-bold mb-2">Invoice System Coming Soon</h2>
            <p className="opacity-80 max-w-md mx-auto">
              We're building a powerful invoicing system with automated reminders, 
              payment tracking, and PDF generation.
            </p>
          </div>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Projects Eligible for Invoicing
            </CardTitle>
            <CardDescription>
              These projects have outstanding balances that can be invoiced.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {eligibleProjects.map((project) => (
                <div 
                  key={project.id} 
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">{project.client}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${project.amount.toLocaleString()}</p>
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}