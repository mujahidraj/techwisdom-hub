import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Search, Download, Trash2, Edit, FileOutput, KeyRound } from 'lucide-react';
import { format } from 'date-fns';

export default function SecurityAudit() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['security_audit_logs'],
    queryFn: async () => {
      // Fetch logs and join with profiles to get the full name of who did it
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error("No audit_logs table exists yet. Please run the SQL migration.", error);
        return [];
      }

      // Fetch profiles manually to map full names
      const logsData = data as any[] || [];
      const userIds = [...new Set(logsData.map(log => log.user_id).filter(Boolean))];
      
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, id, full_name, email')
          .in('id', userIds);
          
        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.id] = p;
            if (p.user_id) profilesMap[p.user_id] = p;
          });
        }
      }

      return logsData.map(log => ({
        ...log,
        profile: profilesMap[log.user_id] || null
      }));
    }
  });

  const getActionIcon = (action: string) => {
    switch (action.toUpperCase()) {
      case 'DELETE': return <Trash2 className="h-4 w-4 text-destructive" />;
      case 'UPDATE': return <Edit className="h-4 w-4 text-warning" />;
      case 'EXPORT': return <FileOutput className="h-4 w-4 text-primary" />;
      case 'LOGIN': return <KeyRound className="h-4 w-4 text-success" />;
      default: return <ShieldAlert className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const filteredLogs = logs.filter(log => 
    log.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.entity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,User,Action,Entity,Description\n"
      + filteredLogs.map(l => `"${format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss')}","${l.profile?.full_name || 'System'}","${l.action_type}","${l.entity_name}","${l.description}"`).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `security_audit_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-8 w-8 text-destructive" />
              Security & Activity Audit
            </h1>
            <p className="text-muted-foreground mt-1">Live Big Brother view: Track exactly who did what and when.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
              <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No Security Logs Found</h3>
              <p className="text-muted-foreground mt-2">
                If the list is completely empty, you may need to run the SQL migration <br/>
                provided to create the `audit_logs` table in Supabase.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Timestamp</th>
                    <th className="px-6 py-4 font-medium">User</th>
                    <th className="px-6 py-4 font-medium">Action</th>
                    <th className="px-6 py-4 font-medium">Target Entity</th>
                    <th className="px-6 py-4 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {log.profile?.full_name || 'System Admin'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline" className="flex items-center gap-1 w-max">
                          {getActionIcon(log.action_type)}
                          {log.action_type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono">
                          {log.entity_name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {log.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
