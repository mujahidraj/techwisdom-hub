/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Users, FolderKanban, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight,
  Clock, Plus, FileText, Zap, Calendar, CheckSquare,
  PieChart, Lightbulb, X, MoreHorizontal, AlertCircle,
  PartyPopper,
  MapPin,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell
} from 'recharts';
import { toast } from 'sonner';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const COLORS = ['#C00707', '#FF4400', '#FFB33F', '#134E8E'];




export default function Dashboard() {
  // 1. ALL HOOKS MUST BE DECLARED FIRST (Top Level)
  const { user, loading } = useAuth(); // Added loading here
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State Hooks
  const [todoInput, setTodoInput] = useState('');
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', start_time: '' });
  const [isNavigating, setIsNavigating] = useState(false);

  // Effect Hooks
  useEffect(() => {
    if (!user?.id) return;

    const setOnline = async () => {
      await supabase.from('profiles' as any).update({ status: 'online' }).eq('id', user.id);
    };

    const setOffline = async () => {
      await supabase.from('profiles' as any).update({ status: 'offline' }).eq('id', user.id);
    };

    setOnline();

    const handleBeforeUnload = () => {
      setOffline();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      setOffline();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user?.id]);

  // Mutation Hooks
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await supabase.from('profiles' as any).update({ status }).eq('id', user?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_status'] });
      toast.success("Status updated");
    }
  });

  // Query Hooks
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_status'],
    queryFn: async () => {
      // 1. Get all user IDs that are NOT clients
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .neq('role', 'client');

      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);

      // 2. Get profiles for those users
      const { data: members } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, status')
        .in('id', userIds);

      return members || [];
    },
    refetchInterval: 5000
  });

  const { data: todaysFocus = [] } = useQuery({
    queryKey: ['todays_focus'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('daily_focus' as any)
        .select('*')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['upcoming_events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_events' as any)
        .select('*')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data || [];
    }
  });

  const { data: todaysEvents = [] } = useQuery({
    queryKey: ['todays_events'],
    queryFn: async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('company_events' as any)
        .select('*')
        .gte('event_date', startOfToday.toISOString())
        .lte('event_date', endOfToday.toISOString())
        .order('event_date', { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    }
  });

  const { data: leadsData } = useQuery({ queryKey: ['dash_leads'], queryFn: async () => (await supabase.from('leads').select('id, status')).data });
  const { data: projectsData } = useQuery({ queryKey: ['dash_projects'], queryFn: async () => (await supabase.from('active_projects').select('*')).data });
  const { data: unreadMessages } = useQuery({ queryKey: ['dash_msgs'], queryFn: async () => (await supabase.from('client_messages').select('id').eq('is_read', false)).data?.length || 0 });
  const { data: recentLeads } = useQuery({ queryKey: ['dash_recent'], queryFn: async () => (await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(5)).data });

  const { data: priorityTicketsCount = 0 } = useQuery({
    queryKey: ['priority_tickets_count'],
    queryFn: async () => {
      const { data: it } = await supabase.from('it_tickets').select('id').in('priority', ['urgent', 'high']).not('status', 'in', '("resolved","closed")');
      const { data: client } = await supabase.from('client_tickets').select('id').in('priority', ['urgent', 'high']).not('status', 'in', '("resolved","closed")');
      return (it?.length || 0) + (client?.length || 0);
    }
  });

  // More Mutation Hooks
  const addFocusMutation = useMutation({
    mutationFn: async (task: string) => {
      const { error } = await supabase.from('daily_focus' as any).insert({ task });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todays_focus'] });
      setTodoInput('');
      toast.success("Task added");
    },
    onError: (err) => toast.error("Failed to add task: " + err.message)
  });

  const toggleFocusMutation = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      await supabase.from('daily_focus' as any).update({ is_completed: !current }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todays_focus'] })
  });

  const deleteFocusMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('daily_focus' as any).delete().eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todays_focus'] })
  });

  const addEventMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('company_events' as any).insert({
        title: newEvent.title,
        event_date: newEvent.start_time
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcoming_events'] });
      queryClient.invalidateQueries({ queryKey: ['todays_events'] });
      setIsAddEventOpen(false);
      setNewEvent({ title: '', start_time: '' });
      toast.success("Event scheduled");
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('company_events' as any).delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcoming_events'] });
      queryClient.invalidateQueries({ queryKey: ['todays_events'] });
      toast.success("Event removed");
    }
  });

  // --- 2. CALCULATIONS (Pure Logic, No Hooks) ---
  const totalLeads = leadsData?.length || 0;
  const activeProjects = projectsData?.filter((p: any) => p.status === 'active')?.length || 0;
  const wonDeals = leadsData?.filter((l: any) => l.status === 'deal_won')?.length || 0;
  const conversionRate = totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0;
  const totalRevenue = projectsData?.reduce((sum: number, p: any) => sum + Number(p.total_budget || 0), 0) || 0;
  const totalPaid = projectsData?.reduce((sum: number, p: any) => sum + Number(p.paid_amount || 0), 0) || 0;

  const upcomingDeadlines = projectsData
    ?.filter((p: any) => p.deadline && p.status === 'active')
    ?.sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    ?.slice(0, 3) || [];

  const stats = [
    { title: 'Total Leads', value: totalLeads.toString(), change: totalLeads > 0 ? `${totalLeads} leads` : 'No leads', trend: 'up' as const, icon: Users, description: 'in pipeline', color: 'text-[#C00707]', bg: 'bg-[#C00707]/10', route: '/crm' },
    { title: 'Active Projects', value: activeProjects.toString(), change: `${activeProjects} active`, trend: 'up' as const, icon: FolderKanban, description: 'ongoing work', color: 'text-[#FF4400]', bg: 'bg-[#FF4400]/10', route: '/projects' },
    { title: 'Conversion Rate', value: `${conversionRate}%`, change: `${wonDeals} won`, trend: conversionRate > 20 ? 'up' as const : 'down' as const, icon: TrendingUp, description: 'lead-to-deal', color: 'text-[#FFB33F]', bg: 'bg-[#FFB33F]/10', route: '/crm' },
    { title: 'Total Revenue', value: formatCurrency(totalRevenue), change: `${formatCurrency(totalPaid)} paid`, trend: 'up' as const, icon: DollarSign, description: 'lifetime value', color: 'text-[#134E8E]', bg: 'bg-[#134E8E]/10', route: '/finances' },
  ];




  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-[#C00707]';
      case 'contacted': return 'bg-[#FF4400]';
      case 'deal_won': return 'bg-[#FFB33F]';
      default: return 'bg-slate-500';
    }



  };

  const chartData = projectsData?.slice(0, 7).map((p: any) => ({
    name: p.project_name.substring(0, 10) + '...',
    Budget: p.total_budget || 0,
    Paid: p.paid_amount || 0
  })) || [];

  const pieData = [
    { name: 'Dev', value: projectsData?.filter((p: any) => p.stage === 'development').length || 0 },
    { name: 'Design', value: projectsData?.filter((p: any) => p.stage === 'design').length || 0 },
    { name: 'QA', value: projectsData?.filter((p: any) => p.stage === 'qa').length || 0 },
  ].filter(d => d.value > 0);

  const monthlyGoal = 300000;
  const goalProgress = Math.min((totalRevenue / monthlyGoal) * 100, 100);

  // --- 3. LOADING GUARD (Must be AFTER all hooks) ---
  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-b-[#FF4400] animate-spin" style={{ animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-sm text-[#C00707] font-bold uppercase tracking-widest animate-pulse">Syncing Hub...</p>
        </div>
      </div>



    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // --- 4. RENDER (Main Return) ---
  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in pb-10">

        {/* PWA INSTALL BANNER */}
        <PWAInstallBanner />

        {/* TODAY'S ACTIVE EVENT BANNER */}
        {todaysEvents.length > 0 && (
          <div className="relative group overflow-hidden rounded-[2.5rem] bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 p-7 shadow-2xl shadow-[#C00707]/5 transition-all duration-500 hover:shadow-[#C00707]/10 flex flex-col md:flex-row items-center justify-between gap-6">

            {/* Glowing Accent Borders & Aura */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-[#C00707] via-[#FF4400] to-[#FFB33F]" />
            <div className="absolute -right-20 -top-20 h-64 w-64 bg-gradient-to-br from-[#C00707]/10 via-[#FF4400]/5 to-transparent rounded-full blur-3xl opacity-70 group-hover:scale-110 transition-transform duration-1000" />

            {/* Main Content Area */}
            <div className="flex items-center gap-5 relative z-10 w-full md:w-auto">
              {/* Animated Glowing Icon Ring */}
              <div className="relative shrink-0">
                <div className="absolute -inset-2 bg-gradient-to-tr from-[#C00707] to-[#FFB33F] rounded-2xl blur-md opacity-35 group-hover:opacity-60 transition duration-700 animate-pulse" />
                <div className="relative p-4 bg-gradient-to-br from-[#C00707] to-[#FF4400] text-white rounded-2xl shadow-lg shadow-[#C00707]/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                  <PartyPopper className="h-6 w-6 text-white animate-bounce" style={{ animationDuration: '3s' }} />
                </div>
              </div>

              {/* Text Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4400] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C00707]"></span>
                  </span>
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C00707] dark:text-[#FFB33F] border-[#C00707]/20 dark:border-[#FFB33F]/20 px-2 py-0">
                    Happening Today
                  </Badge>
                  {todaysEvents[0].location && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold dark:text-slate-400">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <span>{todaysEvents[0].location}</span>
                    </div>
                  )}
                </div>
                <h3 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white group-hover:text-[#C00707] transition-colors duration-300">
                  {todaysEvents[0].title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-[#FF4400]" />
                  <span>Scheduled for <span className="font-extrabold text-slate-800 dark:text-slate-200">{format(new Date(todaysEvents[0].event_date), 'h:mm a')}</span></span>
                </p>
              </div>
            </div>

            {/* Additional Events Counter and Actions */}
            <div className="flex items-center gap-4 relative z-10 shrink-0 w-full md:w-auto justify-end">
              {todaysEvents.length > 1 && (
                <Badge className="bg-gradient-to-r from-[#134E8E] to-blue-600 hover:from-blue-600 hover:to-[#134E8E] text-white font-extrabold text-[11px] px-4 py-1.5 shadow-md shadow-blue-500/10 border-0 rounded-full transition-all duration-300">
                  +{todaysEvents.length - 1} More Event{todaysEvents.length > 2 ? 's' : ''} Today
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-5 py-2.5 h-auto text-xs font-bold border-slate-200/80 dark:border-slate-800 hover:bg-[#C00707] hover:text-white dark:hover:bg-[#C00707] transition-all duration-300 shadow-sm flex items-center gap-2"
                disabled={isNavigating}
                onClick={() => {
                  setIsNavigating(true);
                  toast.loading("Taking you there...", { id: 'nav-schedule' });
                  setTimeout(() => {
                    toast.dismiss('nav-schedule');
                    navigate('/events');
                  }, 800);
                }}
              >
                {isNavigating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Taking you there...</span>
                  </>
                ) : (
                  <span>View Schedule</span>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* HEADER - REIMAGINED WITH VIBRANT THEME */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-br from-[#C00707]/10 via-[#FF4400]/5 to-transparent p-10 rounded-[2.5rem] border border-[#C00707]/20 shadow-2xl shadow-[#C00707]/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-[0.05] pointer-events-none group-hover:scale-125 group-hover:rotate-12 transition-all duration-1000">
            <Zap className="h-64 w-64 text-[#FF4400]" />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C00707]/10 text-[#C00707] dark:text-[#FFB33F] text-xs font-black mb-6 uppercase tracking-[0.2em] border border-[#C00707]/20">
              <Calendar className="h-4 w-4" />
              {format(new Date(), 'EEEE, MMMM do')}
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">
              {getGreeting()}, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C00707] via-[#FF4400] to-[#134E8E] drop-shadow-sm">
                {user?.email?.split('@')[0]}
              </span> 🚀
            </h1>
            <div className="flex items-center gap-4 mt-8">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-10 w-10 rounded-full border-4 border-white dark:border-slate-900 bg-slate-200 shadow-xl overflow-hidden">
                    <img src={`https://i.pravatar.cc/150?u=${i}`} alt="user" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-semibold text-lg">
                <span className="text-[#C00707] font-black">
                  {priorityTicketsCount + todaysFocus.filter((t: any) => !t.is_completed).length}
                </span> priority tasks pending
              </p>
            </div>
          </div>
        </div>




        {/* TEAM STATUS BAR (Vibrant Edition) */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-slate-800/50 rounded-[2rem] p-8 flex items-center gap-10 overflow-x-auto no-scrollbar shadow-2xl shadow-[#C00707]/5">
          <div className="flex flex-col items-center gap-3 pr-10 border-r-2 border-[#C00707]/10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="relative cursor-pointer group">
                  <div className="absolute -inset-1.5 bg-gradient-to-tr from-[#C00707] to-[#134E8E] rounded-full blur-md opacity-0 group-hover:opacity-70 transition duration-700 animate-pulse"></div>
                  <Avatar className="h-20 w-20 border-4 border-white dark:border-slate-900 relative group-hover:scale-105 transition-transform duration-500 shadow-2xl">
                    <AvatarImage src={teamMembers.find((m: any) => m.id === user?.id)?.avatar_url} />
                    <AvatarFallback className="bg-[#C00707] text-white text-2xl font-black">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className={`absolute bottom-1 right-1 h-6 w-6 rounded-full border-4 border-white dark:border-slate-900 shadow-lg ${teamMembers.find((m: any) => m.id === user?.id)?.status === 'online' ? 'bg-[#FF4400]' : teamMembers.find((m: any) => m.id === user?.id)?.status === 'busy' ? 'bg-[#FFB33F]' : 'bg-slate-400'}`} />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-3 rounded-2xl">
                <div className="px-3 py-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Status</div>
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate('online')} className="rounded-xl h-11 gap-3 focus:bg-[#FF4400]/10">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#FF4400] shadow-sm" /> <span className="font-bold">Active</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate('busy')} className="rounded-xl h-11 gap-3 focus:bg-[#FFB33F]/10">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#FFB33F] shadow-sm" /> <span className="font-bold">Away</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate('offline')} className="rounded-xl h-11 gap-3 focus:bg-slate-50">
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-400 shadow-sm" /> <span className="font-bold">Offline</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-[10px] font-black text-[#C00707] uppercase tracking-widest">Operator</span>
          </div>




          <div className="flex items-center gap-7">
            {teamMembers.filter((m: any) => m.id !== user?.id).map((member: any) => (
              <div key={member.id} className="flex flex-col items-center gap-2 min-w-[70px] group cursor-default">
                <div className="relative">
                  <Avatar className="h-16 w-16 border-2 border-transparent group-hover:border-primary/30 transition-all duration-300 group-hover:scale-110 shadow-sm">
                    <AvatarImage src={member.avatar_url} />
                    <AvatarFallback className="bg-muted text-muted-foreground font-semibold">{member.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm transition-all duration-300 ${member.status === 'online' ? 'bg-green-500 animate-pulse' : member.status === 'busy' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate max-w-[70px] group-hover:text-primary transition-colors">
                  {member.full_name?.split(' ')[0] || 'User'}
                </span>
              </div>
            ))}

            {teamMembers.length <= 1 && (
              <p className="text-sm text-muted-foreground italic ml-4">Waiting for teammates to join...</p>
            )}
          </div>
        </div>

        {/* CLICKABLE STATS */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="glass-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-t-4 cursor-pointer"
              style={{ borderTopColor: stat.color.replace('text-', '').replace('-500', '') }}
              onClick={() => navigate(stat.route)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  {stat.trend === 'up' ? (
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><ArrowUpRight className="h-3 w-3 mr-1" /> +4.5%</Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50"><ArrowDownRight className="h-3 w-3 mr-1" /> -1.2%</Badge>
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">{stat.description}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ═══════════════════════ REDESIGNED SECTION ═══════════════════════ */}

        {/* ROW 1: Revenue Chart + Revenue Goal */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* REVENUE CHART — spans 2 columns */}
          <Card className="lg:col-span-2 glass-card group hover:shadow-xl transition-all duration-500 cursor-pointer" onClick={() => navigate('/finances')}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#C00707] to-[#FF4400] shadow-lg shadow-[#C00707]/20 group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">Revenue Overview</CardTitle>
                    <CardDescription className="text-xs">Budget vs. collected across projects</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] font-bold gap-1">
                  <ArrowUpRight className="h-3 w-3" />Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C00707" stopOpacity={0.25} /><stop offset="95%" stopColor="#C00707" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#134E8E" stopOpacity={0.25} /><stop offset="95%" stopColor="#134E8E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.06} />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `৳${val / 1000}k`} />
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="Budget" stroke="#C00707" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBudget)" />
                  <Area type="monotone" dataKey="Paid" stroke="#134E8E" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPaid)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* REVENUE GOAL + PIE CHART — stacked in right column */}
          <div className="space-y-6">
            <Card
              className="bg-gradient-to-br from-[#C00707] to-[#134E8E] text-white border-0 shadow-2xl shadow-[#C00707]/20 cursor-pointer hover:scale-[1.02] transition-all duration-500 overflow-hidden relative"
              onClick={() => navigate('/finances')}
            >
              <div className="absolute -top-10 -right-10 h-40 w-40 bg-white/10 rounded-full blur-3xl"></div>
              <CardHeader className="relative z-10 pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Revenue Target</CardTitle>
                <div className="flex items-end gap-2 mt-1">
                  <span className="text-3xl font-black">{formatCurrency(totalRevenue)}</span>
                  <span className="text-xs text-white/40 mb-1 font-bold">/ {formatCurrency(monthlyGoal)}</span>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-0">
                <div className="h-2.5 w-full bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full bg-[#FFB33F] shadow-[0_0_20px_rgba(255,179,63,0.5)] transition-all duration-1000 rounded-full" style={{ width: `${goalProgress}%` }}></div>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <p className="text-[10px] font-black uppercase tracking-widest">{goalProgress.toFixed(1)}% achieved</p>
                  <TrendingUp className="h-3.5 w-3.5 animate-bounce" />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card cursor-pointer hover:shadow-lg transition-all duration-300" onClick={() => navigate('/projects')}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs flex items-center gap-2 font-bold">
                  <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <PieChart className="h-3.5 w-3.5 text-violet-500" />
                  </div>
                  Project Stages
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ROW 2: Deadlines + Leads + Today's Focus */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {/* UPCOMING DEADLINES */}
          <Card className="glass-card cursor-pointer hover:shadow-lg transition-all duration-300 group" onClick={() => navigate('/projects')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 group-hover:scale-110 transition-transform">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </div>
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((project: any) => (
                  <div key={project.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{project.project_name}</p>
                      <p className="text-[11px] text-muted-foreground">{project.client_name}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-xs font-bold text-red-600 block">{format(new Date(project.deadline), 'MMM d')}</span>
                      <Badge variant="outline" className="text-[9px] mt-0.5 capitalize">{project.stage}</Badge>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No urgent deadlines 🎉</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* RECENT LEADS */}
          <Card className="glass-card cursor-pointer hover:shadow-lg transition-all duration-300 group" onClick={() => navigate('/crm')}>
            <CardHeader className="pb-2 flex flex-col md:flex-row items-start md:items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 group-hover:scale-110 transition-transform">
                  <Clock className="h-4 w-4 text-blue-500" />
                </div>
                Recent Leads
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">View All</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {recentLeads?.slice(0, 4).map((lead: any) => (
                  <div key={lead.id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${getStatusColor(lead.status)} text-white font-bold text-xs shrink-0`}>
                        {lead.business_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate">{lead.business_name}</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(lead.created_at), 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="capitalize text-[10px] shrink-0">{lead.status.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* TODAY'S FOCUS */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <CheckSquare className="h-4 w-4 text-amber-500" />
                </div>
                Today's Focus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 mb-3 max-h-[180px] overflow-y-auto sidebar-scroll">
                {todaysFocus.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={() => toggleFocusMutation.mutate({ id: item.id, current: item.is_completed })}
                      className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer h-4 w-4"
                    />
                    <span className={`text-xs flex-1 ${item.is_completed ? 'line-through text-muted-foreground' : 'font-medium'}`}>{item.task}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteFocusMutation.mutate(item.id)}>
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))}
                {todaysFocus.length === 0 && <p className="text-[11px] text-muted-foreground italic text-center py-4">No tasks yet — add one below.</p>}
              </div>
              <div className="flex gap-2">
                <Input
                  className="flex-1 bg-muted/50 text-xs px-3 h-8 rounded-lg"
                  placeholder="Add a quick task..."
                  value={todoInput}
                  onChange={(e) => setTodoInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && todoInput && addFocusMutation.mutate(todoInput)}
                />
                <Button size="icon" className="h-8 w-8 rounded-lg" onClick={() => todoInput && addFocusMutation.mutate(todoInput)} disabled={addFocusMutation.isPending}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ROW 3: Events + Activity Feed + Tip */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {/* NEXT EVENTS */}
          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-col md:flex-row items-start md:items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                </div>
                Upcoming Events
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsAddEventOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto sidebar-scroll">
                {upcomingEvents.map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 group hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-2 rounded-lg font-bold text-[10px] text-center min-w-[44px] shadow-sm">
                        {format(new Date(event.event_date), 'h:mm')}
                        <div className="text-[8px] uppercase opacity-80">{format(new Date(event.event_date), 'MMM d')}</div>
                      </div>
                      <span className="text-xs font-semibold truncate">{event.title}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive shrink-0" onClick={() => deleteEventMutation.mutate(event.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {upcomingEvents.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No upcoming events</p>}
              </div>
            </CardContent>
          </Card>

          {/* LIVE ACTIVITY FEED */}
          <ActivityFeed />

          {/* QUICK ACTIONS */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { label: 'New Lead', icon: Users, route: '/crm', color: 'from-[#C00707] to-[#FF4400]' },
                { label: 'New Project', icon: FolderKanban, route: '/projects', color: 'from-indigo-500 to-violet-600' },
                { label: 'Invoice', icon: FileText, route: '/invoices', color: 'from-emerald-500 to-green-600' },
                { label: 'Task Board', icon: CheckSquare, route: '/kanban', color: 'from-amber-500 to-orange-500' },
              ].map(action => (
                <Button
                  key={action.label}
                  variant="ghost"
                  className="h-auto flex-col gap-2 py-4 rounded-xl hover:bg-muted/60 transition-all group border border-transparent hover:border-border/50"
                  onClick={() => navigate(action.route)}
                >
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${action.color} shadow-sm group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold">{action.label}</span>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* --- ADD EVENT DIALOG --- */}
        <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Event</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Event Title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
              <Input type="datetime-local" value={newEvent.start_time} onChange={e => setNewEvent({ ...newEvent, start_time: e.target.value })} />
            </div>
            <DialogFooter>
              <Button onClick={() => addEventMutation.mutate()} disabled={!newEvent.title || !newEvent.start_time}>Save Event</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
