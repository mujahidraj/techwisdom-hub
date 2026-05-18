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
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

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
        .eq('user_id', user.id)
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

    const playSound = () => {
      try {
        const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => {
          console.warn("Audio autoplay blocked or failed:", err);
          // Show a small toast if sound is blocked
          toast.info("Notification arrived (Sound blocked by browser)", { duration: 2000 });
        });
      } catch (e) {
        console.error("Audio error:", e);
      }
    };

    // Subscribe to all changes and filter locally for better reliability
    const channel = supabase.channel('app-notifications-live')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_notifications'
      }, (payload) => {
        if (payload.new && String(payload.new.user_id) === String(user.id)) {
          // Play sound for all notifications except the ones we've filtered out of the UI
          const isMuted = [
            'New Direct Message',
            'Team Feed Update',
            'File Received',
            'New Team File',
            'Debug Check',
            'New Message from Team',
            'New Client Message'
          ].includes(payload.new.title);

          if (!isMuted) {
            playSound();
          }

          qc.invalidateQueries({ queryKey: ['notifications', user.id] });
          qc.refetchQueries({ queryKey: ['notifications', user.id] });
        }
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

  // Filter out INTERNAL chat/message notifications ONLY
  const filteredNotifications = notifications.filter((n: any) =>
    n.title !== 'New Direct Message' &&
    n.title !== 'Team Feed Update' &&
    n.title !== 'File Received' &&
    n.title !== 'New Team File' &&
    n.title !== 'Debug Check' &&
    n.title !== 'New Message from Team' &&
    n.title !== 'New Client Message'
  );

  const unreadCount = filteredNotifications.filter(n => !n.is_read).length;

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
        <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-primary/10 transition-colors">
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-[#C00707] animate-pulse ring-2 ring-white shadow-[0_0_8px_rgba(192,7,7,0.6)]" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-32px)] sm:w-85 p-0 shadow-2xl border-primary/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#C00707] to-[#FF4400] text-white">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm uppercase tracking-wider">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-white/20 text-white border-none text-[10px] h-5 px-1.5">
                {unreadCount} New
              </Badge>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="ghost" size="sm" className="h-auto p-1 text-[9px] text-white/70 hover:text-white hover:bg-white/10" onClick={(e) => { e.stopPropagation(); const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3'); audio.play(); toast.success("Audio Unlocked!"); }}>
              🔊 Unlock Sound
            </Button>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-auto p-1 text-[10px] text-white/80 hover:text-white hover:bg-white/10" onClick={() => markAllAsRead.mutate()}>
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center text-muted-foreground bg-slate-50/50">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 opacity-20" />
              </div>
              <p className="text-sm font-medium">No new notifications</p>
              <p className="text-xs opacity-60 mt-1">Check back later for updates</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100">
              {filteredNotifications.map((n: any) => (
                <div
                  key={n.id}
                  className={`p-4 cursor-pointer transition-all duration-200 hover:bg-slate-50 ${!n.is_read ? 'bg-primary/5 border-l-4 border-[#C00707]' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex gap-3 items-start">
                    <div className="mt-1 shrink-0 p-2 bg-white rounded-lg shadow-sm border border-slate-100">{getIcon(n.type)}</div>
                    <div className="flex-1 space-y-1">
                      <p className={`text-[13px] leading-snug ${!n.is_read ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-2">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                    </div>
                    {!n.is_read && <div className="h-2 w-2 rounded-full bg-[#C00707] shrink-0 mt-2 shadow-[0_0_5px_rgba(192,7,7,0.4)]" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-3 border-t bg-slate-50 flex justify-center">
          <Button variant="ghost" size="sm" className="w-full text-xs font-bold text-slate-500 hover:text-primary" onClick={() => { setOpen(false); navigate('/settings/notifications'); }}>
            View All Notification Settings
          </Button>
        </div>

      </PopoverContent>
    </Popover>
  );
}
