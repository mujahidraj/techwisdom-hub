/* eslint-disable @typescript-eslint/no-explicit-any */
import { useActivityLog } from '@/hooks/useActivityLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity, Plus, Edit, Trash2, CheckCircle, Download, Upload, LogIn, LogOut,
  UserPlus, FolderKanban, FileText, MessageSquare, Zap, Loader2, Shield
} from 'lucide-react';

const ACTION_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  CREATE: { icon: Plus, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  UPDATE: { icon: Edit, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  DELETE: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
  EXPORT: { icon: Download, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  IMPORT: { icon: Upload, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  LOGIN: { icon: LogIn, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  LOGOUT: { icon: LogOut, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-900/30' },
  ASSIGN: { icon: UserPlus, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  UNASSIGN: { icon: Trash2, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  SUBMIT: { icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  TRIGGER: { icon: Zap, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
};

export function ActivityFeed() {
  const { activities, isLoading } = useActivityLog();

  const getActionConfig = (actionType: string = '') => {
    const normalized = actionType.toUpperCase();
    if (normalized.includes('CREATE')) return ACTION_CONFIG.CREATE;
    if (normalized.includes('UPDATE')) return ACTION_CONFIG.UPDATE;
    if (normalized.includes('DELETE')) return ACTION_CONFIG.DELETE;
    if (normalized.includes('EXPORT')) return ACTION_CONFIG.EXPORT;
    if (normalized.includes('IMPORT')) return ACTION_CONFIG.IMPORT;
    if (normalized.includes('LOGIN')) return ACTION_CONFIG.LOGIN;
    if (normalized.includes('LOGOUT')) return ACTION_CONFIG.LOGOUT;
    if (normalized.includes('ASSIGN')) return ACTION_CONFIG.ASSIGN;
    if (normalized.includes('UNASSIGN')) return ACTION_CONFIG.UNASSIGN;
    
    return ACTION_CONFIG[normalized] || { icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' };
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Live Audit Feed
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono text-muted-foreground uppercase tracking-wider">
            Big Brother Logs
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[380px] px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-semibold">No audit logs recorded yet.</p>
              <p className="text-xs mt-1 text-center max-w-[200px]">System activity and security audits will appear here in real-time.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-border/50" />
              
              <div className="space-y-1">
                {activities.map((activity, index) => {
                  const config = getActionConfig(activity.action_type);
                  const IconComp = config.icon;
                  return (
                    <div
                      key={activity.id}
                      className="relative flex items-start gap-3 pl-1 py-2 group animate-in fade-in slide-in-from-left-2"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {/* Timeline dot */}
                      <div className={`relative z-10 p-1.5 rounded-full ${config.bg} shadow-sm ring-2 ring-card shrink-0 group-hover:scale-110 transition-transform`}>
                        <IconComp className={`h-3 w-3 ${config.color}`} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-xs leading-relaxed">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {activity.metadata?.user_name || 'System'}
                          </span>
                          {' '}
                          <span className="text-muted-foreground dark:text-slate-400">
                            {activity.description}
                          </span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium flex items-center gap-1.5">
                          <span>
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="font-mono text-[9px] text-slate-400">
                            {activity.action_type}
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
