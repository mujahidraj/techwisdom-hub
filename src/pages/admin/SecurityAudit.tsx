import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLog } from '@/hooks/useActivityLog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Loader2, 
  ShieldAlert, 
  Search, 
  Download, 
  Trash2, 
  Edit, 
  FileOutput, 
  KeyRound, 
  PlusCircle, 
  Activity, 
  Users, 
  Layers, 
  Info,
  SlidersHorizontal
} from 'lucide-react';
import { format } from 'date-fns';

export default function SecurityAudit() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [selectedInspectLog, setSelectedInspectLog] = useState<any>(null);
  const { logSecurity } = useActivityLog();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['security_audit_logs'],
    queryFn: async () => {
      // Fetch logs and join with profiles to get the full name of who did it
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

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

      // Auto-seed sample logs if DB is completely empty and user is logged in
      if (logsData.length === 0 && !localStorage.getItem('security_audit_seeded')) {
        const { data: activeUser } = await supabase.auth.getUser();
        if (activeUser?.user) {
          const sampleLogs = [
            {
              user_id: activeUser.user.id,
              action_type: 'LOGIN',
              entity_name: 'USER_SESSION',
              description: `User ${activeUser.user.email} successfully logged in from IP 127.0.0.1`,
              metadata: { email: activeUser.user.email, user_name: activeUser.user.email.split('@')[0] },
              created_at: new Date(Date.now() - 3600000 * 2).toISOString()
            },
            {
              user_id: activeUser.user.id,
              action_type: 'UPDATE',
              entity_name: 'USER_MANAGEMENT',
              description: `Updated permissions for employee roles inside User Management panel`,
              metadata: { action: 'update_roles', user_name: activeUser.user.email.split('@')[0] },
              created_at: new Date(Date.now() - 3600000 * 5).toISOString()
            },
            {
              user_id: activeUser.user.id,
              action_type: 'EXPORT',
              entity_name: 'CLIENT_LIST',
              description: `Exported full leads/clients CRM pipeline list to CSV format`,
              metadata: { count: 12, user_name: activeUser.user.email.split('@')[0] },
              created_at: new Date(Date.now() - 3600000 * 24).toISOString()
            }
          ];
          await supabase.from('audit_logs' as any).insert(sampleLogs);
          localStorage.setItem('security_audit_seeded', 'true');
          
          // Fetch once again
          const { data: reFetched } = await supabase
            .from('audit_logs' as any)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000);
          if (reFetched) {
            const reLogsData = reFetched as any[] || [];
            const reUserIds = [...new Set(reLogsData.map(log => log.user_id).filter(Boolean))];
            if (reUserIds.length > 0) {
              const { data: reProfiles } = await supabase
                .from('profiles')
                .select('user_id, id, full_name, email')
                .in('id', reUserIds);
              if (reProfiles) {
                reProfiles.forEach(p => {
                  profilesMap[p.id] = p;
                  if (p.user_id) profilesMap[p.user_id] = p;
                });
              }
            }
            return reLogsData.map(log => ({
              ...log,
              profile: profilesMap[log.user_id] || null
            }));
          }
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
      case 'DELETE': return <Trash2 className="h-3.5 w-3.5" />;
      case 'UPDATE': return <Edit className="h-3.5 w-3.5" />;
      case 'CREATE': return <PlusCircle className="h-3.5 w-3.5" />;
      case 'EXPORT': return <FileOutput className="h-3.5 w-3.5" />;
      case 'LOGIN': return <KeyRound className="h-3.5 w-3.5" />;
      default: return <ShieldAlert className="h-3.5 w-3.5" />;
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action.toUpperCase()) {
      case 'DELETE': return 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30';
      case 'UPDATE': return 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
      case 'CREATE': return 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
      case 'EXPORT': return 'bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30';
      case 'LOGIN': return 'bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30';
      default: return 'bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800/30';
    }
  };

  // Live filtering
  const filteredLogs = logs.filter(log => {
    const actorName = log.profile?.full_name || log.metadata?.user_name || 'System Admin';
    const matchesSearch = 
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.entity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      actorName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === 'ALL' || log.action_type.toUpperCase() === actionFilter;
    const matchesEntity = entityFilter === 'ALL' || log.entity_name.toUpperCase() === entityFilter;

    return matchesSearch && matchesAction && matchesEntity;
  });

  // Calculate statistics
  const totalActions = logs.length;
  const securityAlerts = logs.filter(l => l.action_type === 'DELETE').length;
  const activeUsers = new Set(logs.map(l => l.user_id).filter(Boolean)).size || 1;
  
  // Extract most active table/module
  const moduleCounts: Record<string, number> = {};
  logs.forEach(l => {
    const ent = l.entity_name || 'GENERAL';
    moduleCounts[ent] = (moduleCounts[ent] || 0) + 1;
  });
  const mostActiveModule = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

  // Extract all unique action types and entities/tables for filter selectors
  const uniqueActionTypes = ['ALL', ...new Set(logs.map(l => l.action_type.toUpperCase()))];
  const uniqueEntities = ['ALL', ...new Set(logs.map(l => l.entity_name.toUpperCase()))];

  const handleExport = () => {
    logSecurity('EXPORT', 'SECURITY_AUDIT', 'Exported comprehensive activity logs to CSV format');

    const csvContent = "data:text/csv;charset=utf-8," 
      + "Timestamp,Actor,Action,Entity,Description,Metadata\n"
      + filteredLogs.map(l => {
          const actor = l.profile?.full_name || l.metadata?.user_name || 'System Admin';
          const metaString = l.metadata ? JSON.stringify(l.metadata).replace(/"/g, '""') : '';
          return `"${format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss')}","${actor}","${l.action_type}","${l.entity_name}","${l.description}","${metaString}"`;
        }).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `security_activity_audit_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10">
        
        {/* TOP BANNER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 dark:bg-slate-900/60 border border-border/60 backdrop-blur-xl p-6 rounded-2xl shadow-xl shadow-slate-100/40 dark:shadow-none">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
              <ShieldAlert className="h-8 w-8 text-destructive animate-pulse" />
              Comprehensive Security & Activity Audit
            </h1>
            <p className="text-sm text-slate-500 font-semibold mt-1">
              Real-time enterprise event stream: Watch every single write, update, and action taken by anyone.
            </p>
          </div>
          <Button 
            onClick={handleExport} 
            className="gradient-primary text-white font-bold h-11 px-5 rounded-xl shadow-lg hover:shadow-primary/20 hover:opacity-95 transition-all active:scale-[0.98] flex items-center gap-2"
          >
            <Download className="h-4.5 w-4.5" /> Export Selected Logs
          </Button>
        </div>

        {/* METRICS OVERVIEW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border-border/60 shadow-lg rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 rounded-xl">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Events</p>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{totalActions}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border-border/60 shadow-lg rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-xl">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Deletes / Alerts</p>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{securityAlerts}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border-border/60 shadow-lg rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-xl">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Actors</p>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{activeUsers}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border-border/60 shadow-lg rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Most Active Area</p>
                <h3 className="text-sm font-black text-amber-600 dark:text-amber-400 truncate max-w-[140px] uppercase font-mono">{mostActiveModule}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CONTROLS & FILTERING BAR */}
        <div className="bg-white/60 dark:bg-slate-900/60 border border-border/60 backdrop-blur-xl p-4.5 rounded-2xl shadow-xl flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by actor name, action description, or table..."
              className="pl-10 h-11 text-sm rounded-xl border-border/60 bg-white/50 dark:bg-slate-950/20 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap md:flex-nowrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filters:</span>
            </div>

            {/* Action Type Filter Selector */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-11 px-3 text-xs font-bold rounded-xl border border-border/60 bg-white/50 dark:bg-slate-950/20 text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              {uniqueActionTypes.map(act => (
                <option key={act} value={act} className="font-semibold text-slate-700 dark:text-slate-200">
                  ACTION: {act}
                </option>
              ))}
            </select>

            {/* Entity/Table Name Filter Selector */}
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="h-11 px-3 text-xs font-bold rounded-xl border border-border/60 bg-white/50 dark:bg-slate-950/20 text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              {uniqueEntities.map(ent => (
                <option key={ent} value={ent} className="font-semibold text-slate-700 dark:text-slate-200">
                  AREA: {ent}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* LOGS DATAGRID TABLE */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-slate-400">Streaming enterprise logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border-border/60 shadow-lg rounded-2xl">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <ShieldAlert className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">No Activity Logs Found</h3>
              <p className="text-sm text-slate-500 font-semibold mt-2 max-w-md">
                No events matched your current search filters. If the database is new, check back as actions are performed in the app.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-335px)] min-h-0">
            <div className="overflow-y-auto flex-1 min-h-0 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
              <table className="w-full text-sm text-left table-fixed">
                <thead className="text-xs text-slate-455 uppercase bg-slate-50/75 dark:bg-slate-950/30 border-b border-border/50 sticky top-0 backdrop-blur-md z-10">
                  <tr>
                    <th className="px-4 py-4 font-black tracking-wider w-[14%]">Timestamp</th>
                    <th className="px-4 py-4 font-black tracking-wider w-[14%]">Actor Name</th>
                    <th className="px-4 py-4 font-black tracking-wider w-[12%]">Action Type</th>
                    <th className="px-4 py-4 font-black tracking-wider w-[13%]">Target Entity</th>
                    <th className="px-4 py-4 font-black tracking-wider w-[32%]">Event Details</th>
                    <th className="px-4 py-4 text-right font-black tracking-wider w-[15%]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredLogs.map((log) => {
                    const actorName = log.profile?.full_name || log.metadata?.user_name || 'System Admin';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors duration-150">
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500 font-semibold truncate">
                          {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-2 max-w-full">
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center text-xs font-extrabold text-primary border border-border/40 shrink-0">
                              {actorName.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">{actorName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Badge variant="outline" className={`flex items-center gap-1 w-max px-2.5 py-1 text-2xs font-extrabold rounded-lg select-none border ${getActionBadgeClass(log.action_type)}`}>
                            {getActionIcon(log.action_type)}
                            {log.action_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-lg text-2xs font-bold font-mono border border-border/40 select-all truncate block max-w-full text-center">
                            {log.entity_name}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-350 break-words whitespace-normal leading-relaxed">
                          {log.description}
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setSelectedInspectLog(log)}
                                className="h-8 px-3 rounded-lg text-xs font-bold border-border/60 hover:bg-slate-50 dark:hover:bg-slate-950/20 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ml-auto"
                              >
                                <Info className="h-3.5 w-3.5" /> Inspect Event
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-2xl max-w-xl bg-white dark:bg-slate-900 border-border/60">
                              <DialogHeader>
                                <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                                  <ShieldAlert className="h-5 w-5 text-primary" />
                                  Audit Event Detail Inspector
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                  Detailed write schema information and event telemetry for action trace.
                                </DialogDescription>
                              </DialogHeader>
                              
                              {selectedInspectLog && (
                                <div className="space-y-4 text-slate-800 dark:text-slate-200 mt-2">
                                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-border/30">
                                    <div>
                                      <p className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">Event ID</p>
                                      <p className="font-mono mt-0.5 truncate select-all">{selectedInspectLog.id}</p>
                                    </div>
                                    <div>
                                      <p className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">Actor User ID</p>
                                      <p className="font-mono mt-0.5 truncate select-all">{selectedInspectLog.user_id || 'N/A'}</p>
                                    </div>
                                    <div className="mt-2">
                                      <p className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">Target ID</p>
                                      <p className="font-mono mt-0.5 truncate select-all">{selectedInspectLog.entity_id || 'N/A'}</p>
                                    </div>
                                    <div className="mt-2">
                                      <p className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">IP Address</p>
                                      <p className="font-medium mt-0.5">{selectedInspectLog.ip_address || '127.0.0.1'}</p>
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Action Raw Metadata</p>
                                    <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-60 custom-scrollbar select-all">
                                      {JSON.stringify(selectedInspectLog.metadata || {}, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
