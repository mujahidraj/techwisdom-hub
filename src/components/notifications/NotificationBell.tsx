import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, Info, CheckCircle2, AlertTriangle, AlertCircle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30000 // Polling every 30s as a fallback, though we use real-time below
  });

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('realtime-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ['notifications', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('app_notifications').update({ is_read: true }).eq('id', id);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications', user?.id] });
      const previous = qc.getQueryData(['notifications', user?.id]);
      qc.setQueryData(['notifications', user?.id], (old: any) => old.map((n: any) => n.id === id ? { ...n, is_read: true } : n));
      return { previous };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications', user?.id] })
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from('app_notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', user?.id] })
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNotificationClick = (n: any) => {
    if (!n.is_read) markAsRead.mutate(n.id);
    if (n.action_link) {
      setOpen(false);
      navigate(n.action_link);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-muted">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl border-border/50">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary" onClick={() => markAllAsRead.mutate()}>
                <Check className="h-3 w-3 mr-1" /> Mark all read
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setOpen(false); navigate('/settings/notifications'); }}>
              <Settings className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mb-3 opacity-20" />
              <p className="text-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n: any) => (
                <div 
                  key={n.id} 
                  className={`p-4 border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/50 ${!n.is_read ? 'bg-primary/5' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex gap-3 items-start">
                    <div className="mt-0.5">{getIcon(n.type)}</div>
                    <div className="flex-1 space-y-1">
                      <p className={`text-sm leading-tight ${!n.is_read ? 'font-semibold' : 'text-muted-foreground'}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground opacity-70">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                    </div>
                    {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
