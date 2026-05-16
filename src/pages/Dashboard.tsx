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
  PieChart, Lightbulb, X, MoreHorizontal, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell
} from 'recharts';
import { toast } from 'sonner';
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
      const { data } = await supabase.from('profiles' as any).select('id, full_name, avatar_url, status') as any;
      return data || [];
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
        .from('events' as any)
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data || [];
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
      const { error } = await supabase.from('events' as any).insert({
        title: newEvent.title,
        start_time: newEvent.start_time
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcoming_events'] });
      setIsAddEventOpen(false);
      setNewEvent({ title: '', start_time: '' });
      toast.success("Event scheduled");
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('events' as any).delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcoming_events'] });
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

  const monthlyGoal = 500000;
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

        <div className="grid gap-6 lg:grid-cols-3">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">

            {/* 1. REVENUE CHART */}
            <Card className="glass-card cursor-pointer hover:shadow-2xl transition-all duration-500 border-[#C00707]/10 group" onClick={() => navigate('/finances')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
                  <div className="p-2 bg-[#C00707]/10 rounded-lg group-hover:rotate-12 transition-transform">
                    <TrendingUp className="h-6 w-6 text-[#C00707]" />
                  </div>
                  Scale Pulse
                </CardTitle>
                <CardDescription>Fiscal trajectory overview</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C00707" stopOpacity={0.3} /><stop offset="95%" stopColor="#C00707" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#134E8E" stopOpacity={0.3} /><stop offset="95%" stopColor="#134E8E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.05} />
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val / 1000}k`} />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="Budget" stroke="#C00707" strokeWidth={3} fillOpacity={1} fill="url(#colorBudget)" />
                    <Area type="monotone" dataKey="Paid" stroke="#134E8E" strokeWidth={3} fillOpacity={1} fill="url(#colorPaid)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>




            {/* 2. UPCOMING DEADLINES */}
            <Card className="glass-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" /> Upcoming Deadlines
                </CardTitle>
                <CardDescription>Projects due soon (Click to view all)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((project: any) => (
                    <div key={project.id} className="p-3 rounded-lg bg-red-50/50 border border-red-100 flex justify-between items-center group">
                      <div>
                        <p className="font-medium truncate group-hover:text-primary transition-colors">{project.project_name}</p>
                        <p className="text-xs text-muted-foreground">{project.client_name}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-red-600 block">
                          {format(new Date(project.deadline), 'MMM d')}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-white mt-1 capitalize">
                          {project.stage}
                        </Badge>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No urgent deadlines.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3. RECENT LEADS */}
            <Card className="glass-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/crm')}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-500" /> Recent Leads</CardTitle>
                </div>
                <Button variant="ghost" size="sm">View All</Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentLeads?.map((lead: any) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${getStatusColor(lead.status)} text-white font-bold`}>
                          {lead.business_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm group-hover:text-primary transition-colors">{lead.business_name}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(lead.created_at), 'MMM d, h:mm a')}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="capitalize">{lead.status.replace('_', ' ')}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">

            {/* 4. REVENUE GOAL */}
            <Card
              className="bg-gradient-to-br from-[#C00707] to-[#134E8E] text-white border-0 shadow-2xl shadow-[#C00707]/20 cursor-pointer hover:scale-[1.05] transition-all duration-500 overflow-hidden relative"
              onClick={() => navigate('/finances')}
            >
              <div className="absolute -top-10 -right-10 h-40 w-40 bg-white/10 rounded-full blur-3xl"></div>
              <CardHeader className="relative z-10">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-white/70">Profit Target</CardTitle>
                <div className="flex items-end gap-2 mt-2">
                  <span className="text-4xl font-black">{formatCurrency(totalRevenue)}</span>
                  <span className="text-sm text-white/50 mb-1 font-bold">/ {formatCurrency(monthlyGoal)}</span>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="h-3 w-full bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full bg-[#FFB33F] shadow-[0_0_20px_rgba(255,179,63,0.5)] transition-all duration-1000" style={{ width: `${goalProgress}%` }}></div>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <p className="text-xs font-black uppercase tracking-widest">{goalProgress.toFixed(1)}% MOMENTUM</p>
                  <TrendingUp className="h-4 w-4 animate-bounce" />
                </div>
              </CardContent>
            </Card>




            {/* 5. PROJECT STAGES */}
            <Card className="glass-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/projects')}>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><PieChart className="h-4 w-4" /> Active Stages</CardTitle></CardHeader>
              <CardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>



            {/* --- TODAY'S FOCUS --- */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Today's Focus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4 max-h-[150px] overflow-y-auto">
                  {todaysFocus.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <input
                        type="checkbox"
                        checked={item.is_completed}
                        onChange={() => toggleFocusMutation.mutate({ id: item.id, current: item.is_completed })}
                        className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className={`text-sm flex-1 ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>{item.task}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteFocusMutation.mutate(item.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {todaysFocus.length === 0 && <p className="text-xs text-muted-foreground italic">No tasks yet.</p>}
                </div>
                <div className="flex gap-2">
                  <Input
                    className="flex-1 bg-muted/50 text-xs px-2 h-8"
                    placeholder="Add task..."
                    value={todoInput}
                    onChange={(e) => setTodoInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && todoInput && addFocusMutation.mutate(todoInput)}
                  />
                  <Button size="icon" className="h-8 w-8" onClick={() => todoInput && addFocusMutation.mutate(todoInput)} disabled={addFocusMutation.isPending}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* --- REAL EVENTS --- */}
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Next Events</CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsAddEventOpen(true)}><Plus className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {upcomingEvents.map((event: any) => (
                    <div key={event.id} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-100 group">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-200 text-blue-700 p-2 rounded-md font-bold text-xs text-center min-w-[50px]">
                          {format(new Date(event.start_time), 'h:mm a')}
                          <div className="text-[9px] uppercase">{format(new Date(event.start_time), 'MMM d')}</div>
                        </div>
                        <div className="text-sm font-medium text-blue-900 line-clamp-1">{event.title}</div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteEventMutation.mutate(event.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {upcomingEvents.length === 0 && <p className="text-xs text-muted-foreground">No events scheduled.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0">
              <CardContent className="p-4 flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-yellow-300 shrink-0 mt-1" />
                <div>
                  <p className="font-bold text-sm">TechWisdom Tip</p>
                  <p className="text-xs text-white/90 mt-1">Review your 'In Negotiation' leads today to close pending deals before the weekend.</p>
                </div>
              </CardContent>
            </Card>

          </div>
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