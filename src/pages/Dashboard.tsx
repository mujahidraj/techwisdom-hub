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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

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
      const { data } = await supabase.from('profiles' as any).select('id, full_name, avatar_url, status');
      return data || [];
    },
    refetchInterval: 5000 
  });

  const { data: todaysFocus = [] } = useQuery({
    queryKey: ['todays_focus'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0,0,0,0);
      
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
    { title: 'Total Leads', value: totalLeads.toString(), change: totalLeads > 0 ? `${totalLeads} leads` : 'No leads', trend: 'up' as const, icon: Users, description: 'in pipeline', color: 'text-blue-500', bg: 'bg-blue-500/10', route: '/crm' },
    { title: 'Active Projects', value: activeProjects.toString(), change: `${activeProjects} active`, trend: 'up' as const, icon: FolderKanban, description: 'ongoing work', color: 'text-purple-500', bg: 'bg-purple-500/10', route: '/projects' },
    { title: 'Conversion Rate', value: `${conversionRate}%`, change: `${wonDeals} won`, trend: conversionRate > 20 ? 'up' as const : 'down' as const, icon: TrendingUp, description: 'lead-to-deal', color: 'text-green-500', bg: 'bg-green-500/10', route: '/crm' },
    { title: 'Total Revenue', value: formatCurrency(totalRevenue), change: `${formatCurrency(totalPaid)} paid`, trend: 'up' as const, icon: DollarSign, description: 'lifetime value', color: 'text-amber-500', bg: 'bg-amber-500/10', route: '/finances' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500';
      case 'contacted': return 'bg-yellow-500';
      case 'deal_won': return 'bg-green-500';
      default: return 'bg-gray-500';
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
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-gray-500 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  // --- 4. RENDER (Main Return) ---
  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
          <div>
            <div className="text-sm text-muted-foreground font-medium mb-1">
              {format(new Date(), 'EEEE, MMMM do, yyyy')}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Good Morning, <span className="text-primary">{user?.email?.split('@')[0]}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-2">
              You have <span className="font-semibold text-foreground">{unreadMessages || 0} unread messages</span>.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20" onClick={() => navigate('/crm')}>
              <Users className="h-4 w-4 mr-2" /> Add Lead
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20" onClick={() => navigate('/projects')}>
              <Plus className="h-4 w-4 mr-2" /> New Project
            </Button>
            <Button variant="outline" className="shadow-sm" onClick={() => navigate('/invoices')}>
              <FileText className="h-4 w-4 mr-2" /> Invoice
            </Button>
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
            <Card className="glass-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/finances')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Revenue vs. Collection</CardTitle>
                <CardDescription>Financial performance</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/><stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/><stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                    <Tooltip />
                    <Area type="monotone" dataKey="Budget" stroke="#8884d8" fillOpacity={1} fill="url(#colorBudget)" />
                    <Area type="monotone" dataKey="Paid" stroke="#82ca9d" fillOpacity={1} fill="url(#colorPaid)" />
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
                className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-xl cursor-pointer hover:scale-[1.02] transition-transform" 
                onClick={() => navigate('/finances')}
            >
              <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-300">Revenue Goal</CardTitle>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold">{formatCurrency(totalRevenue)}</span>
                  <span className="text-sm text-slate-400 mb-1">/ {formatCurrency(monthlyGoal)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={goalProgress} className="h-2 bg-slate-700" />
                <p className="text-xs text-slate-400 mt-2">{goalProgress.toFixed(1)}% achieved</p>
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

            {/* --- TEAM AVAILABILITY --- */}
            <Card className="glass-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/team')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Team Status</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate('online')}>Set Online</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate('busy')}>Set Busy</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate('offline')}>Set Offline</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[200px] overflow-y-auto">
                  {teamMembers.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback>{member.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${member.status === 'online' ? 'bg-green-500' : member.status === 'busy' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                        </div>
                        <span className="text-sm font-medium">{member.full_name || 'User'}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase">{member.status || 'offline'}</Badge>
                    </div>
                  ))}
                </div>
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
                    <Input placeholder="Event Title" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                    <Input type="datetime-local" value={newEvent.start_time} onChange={e => setNewEvent({...newEvent, start_time: e.target.value})} />
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