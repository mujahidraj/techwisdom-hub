import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import logo from '@/assets/techwisdom.png';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2,
  FolderKanban,
  Clock,
  CheckCircle2,
  LogOut,
  MessageSquare,
  Calendar,
  DollarSign,
  FileText,
  Send,
  Loader2,
  LifeBuoy,
  ThumbsUp,
  Download,
  FileSignature
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Tables, Database } from '@/integrations/supabase/types';

type Project = Tables<'active_projects'>;
type ProjectUpdate = Tables<'project_updates'>;
type Invoice = Tables<'invoices'>;
type Message = Tables<'client_messages'>;
type ProjectStage = Database['public']['Enums']['project_stage'];

const stages: ProjectStage[] = [
  'discovery',
  'requirement',
  'strategy',
  'design',
  'development',
  'qa',
  'deployment',
  'maintenance',
];

const stageLabels: Record<ProjectStage, string> = {
  discovery: 'Discovery',
  requirement: 'Requirement',
  strategy: 'Strategy',
  design: 'Design',
  development: 'Development',
  qa: 'QA',
  deployment: 'Deployment',
  maintenance: 'Maintenance',
};

export default function ClientPortal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role, signOut, loading } = useAuth();
  const { sendNotification } = useNotifications();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketPriority, setTicketPriority] = useState<string>('medium');
  const [approvalFeedback, setApprovalFeedback] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get('project');
  const queryTab = searchParams.get('tab');

  useEffect(() => {
    if (!loading && (!user || role !== 'client')) {
      navigate('/auth');
    }
  }, [user, role, loading, navigate]);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['client-projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_projects')
        .select('*')
        .eq('client_id', user?.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (queryProjectId && projects.length > 0) {
      setTimeout(() => {
        const element = document.getElementById(`project-card-${queryProjectId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [queryProjectId, projects]);

  const { data: updates = [] } = useQuery({
    queryKey: ['client-updates', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase
        .from('project_updates')
        .select('*')
        .in('project_id', projects.map(p => p.id))
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as ProjectUpdate[];
    },
    enabled: projects.length > 0,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['client-invoices', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .in('project_id', projects.map(p => p.id))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: projects.length > 0,
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['client-proposals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('proposals' as any).select('*').eq('client_id', user?.id).eq('status', 'sent').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: ['client-deliverables', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase.from('project_deliverables' as any).select('*').in('project_id', projects.map(p => p.id)).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: projects.length > 0,
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ['client-approvals', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase.from('project_approvals' as any).select('*').in('project_id', projects.map(p => p.id)).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: projects.length > 0,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['client-tickets', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase.from('client_tickets' as any).select('*').in('project_id', projects.map(p => p.id)).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: projects.length > 0,
  });

  // Fetch messages for selected project
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['client-messages', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data, error } = await supabase
        .from('client_messages')
        .select('*')
        .eq('project_id', selectedProject)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedProject,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({ projectId, message }: { projectId: string; message: string }) => {
      const { error } = await supabase
        .from('client_messages')
        .insert({
          project_id: projectId,
          sender_id: user?.id,
          message,
          is_read: false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-messages', selectedProject] });
      sendNotification({
        title: 'New Client Message',
        message: `Client sent a message in project: ${projects.find(p => p.id === selectedProject)?.project_name || 'Unknown'}`,
        type: 'info',
        actionLink: `/messages?projectId=${selectedProject}`
      });
      setNewMessage('');
    },
    onError: (error) => {
      toast.error('Failed to send message: ' + error.message);
    },
  });

  // Mark messages as read
  const markReadMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('client_messages')
        .update({ is_read: true })
        .eq('project_id', projectId)
        .neq('sender_id', user?.id);
      if (error) throw error;
    },
  });

  const acceptProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase.from('proposals' as any).update({ status: 'accepted' }).eq('id', proposalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-proposals'] });
      sendNotification({
        title: 'Proposal Accepted',
        message: `A client has accepted and signed a proposal.`,
        type: 'success',
        actionLink: `/finance`
      });
      toast.success("Proposal accepted! Our team will be in touch shortly to kick off the project.");
    },
    onError: (err) => toast.error(err.message)
  });

  const respondApprovalMutation = useMutation({
    mutationFn: async ({ approvalId, status, feedback }: { approvalId: string, status: string, feedback: string }) => {
      const { error } = await supabase.from('project_approvals' as any).update({
        status, client_feedback: feedback || null, resolved_at: new Date().toISOString()
      }).eq('id', approvalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-approvals'] });
      sendNotification({
        title: 'Approval Feedback',
        message: `Client has responded to an approval request.`,
        type: 'info',
        actionLink: `/projects`
      });
      toast.success("Feedback submitted successfully.");
    },
    onError: (err) => toast.error(err.message)
  });

  const createTicketMutation = useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const { error } = await supabase.from('client_tickets' as any).insert({
        project_id: projectId, client_id: user?.id, title: ticketTitle, description: ticketDesc, priority: ticketPriority
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-tickets'] });
      sendNotification({
        title: 'New Support Ticket',
        message: `A client has submitted a new support ticket: ${ticketTitle}`,
        type: 'warning',
        actionLink: `/helpdesk`
      });
      setTicketTitle(''); setTicketDesc('');
      toast.success("Ticket submitted successfully. Our team will review it shortly.");
    },
    onError: (err) => toast.error(err.message)
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when viewing project
  useEffect(() => {
    if (selectedProject) {
      markReadMutation.mutate(selectedProject);
    }
  }, [selectedProject]);

  // Real-time subscription for messages
  useEffect(() => {
    if (!selectedProject) return;

    const channel = supabase
      .channel(`client-messages-${selectedProject}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_messages',
          filter: `project_id=eq.${selectedProject}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['client-messages', selectedProject] });
          markReadMutation.mutate(selectedProject);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProject, queryClient]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedProject) return;
    sendMutation.mutate({ projectId: selectedProject, message: newMessage.trim() });
  };

  const getProgress = (stage: ProjectStage) => ((stages.indexOf(stage) + 1) / stages.length) * 100;

  if (loading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_budget), 0);
  const totalPaid = projects.reduce((sum, p) => sum + Number(p.paid_amount), 0);
  const pendingAmount = totalBudget - totalPaid;

  const activeProject = projects.find(p => p.id === selectedProject) || projects[0] || null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row antialiased font-sans">

      {/* Root Tabs wrapping the entire layout */}
      <Tabs defaultValue="overview" className="flex flex-col md:flex-row w-full min-h-screen">

        {/* Left Premium Sidebar Navigation */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-[#0f172a] text-slate-300 flex flex-col shrink-0 sticky top-0 h-auto md:h-screen z-40 shadow-xl">

          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3 bg-[#090d16]">
            <div className="p-2 bg-[#ff7006] rounded-xl shadow-lg shadow-orange-500/20 shrink-0">
              <img src={logo} className="h-6 w-6 object-contain brightness-0 invert" alt="TechWisdom" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white tracking-tight block">TechWisdom</span>
              <p className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">Client Desk Console</p>
            </div>
          </div>

          {/* Project Selector Dropdown */}
          <div className="p-4 border-b border-slate-800 bg-[#090d16]/40">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Selected Project</label>
            {projects.length === 0 ? (
              <div className="text-xs text-slate-500 font-medium py-2 px-3 border border-slate-800 rounded-lg bg-slate-900">
                No active projects
              </div>
            ) : (
              <Select value={selectedProject || ''} onValueChange={(val) => setSelectedProject(val)}>
                <SelectTrigger className="w-full bg-[#1e293b] border-slate-700 hover:border-slate-600 h-10 font-semibold text-xs rounded-xl text-slate-200 focus:ring-1 focus:ring-[#ff7006] focus:border-[#ff7006] transition-all">
                  <SelectValue placeholder="Select active project" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-slate-700 rounded-xl shadow-2xl text-slate-200">
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id} className="text-xs font-semibold hover:bg-slate-800 cursor-pointer focus:bg-slate-800 focus:text-white">
                      {proj.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Vertical Navigation Tabs */}
          <TabsList className="flex flex-col gap-1 p-3 bg-transparent h-auto items-stretch flex-1">
            <TabsTrigger
              value="overview"
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1e293b]/40 hover:text-slate-100 transition-all justify-start border-l-4 border-transparent data-[state=active]:border-[#ff7006] data-[state=active]:bg-[#ff7006]/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <FolderKanban className="h-4.5 w-4.5 shrink-0" />
              <span>Project Dashboard</span>
            </TabsTrigger>

            <TabsTrigger
              value="messages"
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1e293b]/40 hover:text-slate-100 transition-all justify-start border-l-4 border-transparent data-[state=active]:border-[#ff7006] data-[state=active]:bg-[#ff7006]/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <MessageSquare className="h-4.5 w-4.5 shrink-0" />
              <span>Team Messaging</span>
            </TabsTrigger>

            <TabsTrigger
              value="deliverables"
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1e293b]/40 hover:text-slate-100 transition-all justify-start border-l-4 border-transparent data-[state=active]:border-[#ff7006] data-[state=active]:bg-[#ff7006]/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <FileText className="h-4.5 w-4.5 shrink-0" />
              <span>Shared Assets</span>
            </TabsTrigger>

            <TabsTrigger
              value="approvals"
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1e293b]/40 hover:text-slate-100 transition-all justify-start border-l-4 border-transparent data-[state=active]:border-[#ff7006] data-[state=active]:bg-[#ff7006]/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
              <span>Approvals Required</span>
            </TabsTrigger>

            <TabsTrigger
              value="tickets"
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1e293b]/40 hover:text-slate-100 transition-all justify-start border-l-4 border-transparent data-[state=active]:border-[#ff7006] data-[state=active]:bg-[#ff7006]/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <LifeBuoy className="h-4.5 w-4.5 shrink-0" />
              <span>Support & Helpdesk</span>
            </TabsTrigger>

            <TabsTrigger
              value="billing"
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1e293b]/40 hover:text-slate-100 transition-all justify-start border-l-4 border-transparent data-[state=active]:border-[#ff7006] data-[state=active]:bg-[#ff7006]/10 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <DollarSign className="h-4.5 w-4.5 shrink-0" />
              <span>Billing & Updates</span>
            </TabsTrigger>
          </TabsList>

          {/* User Profile Footer */}
          <div className="p-4 border-t border-slate-800 bg-[#090d16] flex items-center justify-between gap-3 mt-auto">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-200 block truncate leading-none mb-1">{user?.email?.split('@')[0]}</span>
              <span className="text-[9px] font-bold text-slate-500 block truncate">{user?.email}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => signOut()} className="rounded-xl h-8 px-3 border-slate-700 hover:bg-slate-800 hover:text-white bg-slate-900 transition-all text-slate-300 text-[10px] font-bold uppercase tracking-wider">
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Exit
            </Button>
          </div>

        </aside>

        {/* Right Workspace Main Panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">

          {/* Header Bar */}
          <header className="bg-white border-b border-slate-200/80 h-16 shrink-0 flex items-center justify-between px-6 md:px-8 sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Portal Console</span>
              <span className="text-slate-300">/</span>
              {activeProject ? (
                <span className="font-extrabold text-sm text-slate-800 truncate">{activeProject.project_name}</span>
              ) : (
                <span className="font-semibold text-sm text-slate-400">No Project Assigned</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
            </div>
          </header>

          {/* Content Pane */}
          <main className="flex-1 p-6 md:p-8 max-w-5xl w-full mx-auto space-y-6">

            {/* If no active projects exist */}
            {!activeProject ? (
              <Card className="rounded-2xl border border-slate-200 shadow-sm p-16 text-center bg-white">
                <FolderKanban className="h-14 w-14 mx-auto text-slate-355 mb-4 animate-pulse" />
                <h3 className="font-extrabold text-slate-800 text-lg">No active projects assigned</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Once your development coordinator assigns a project to this workspace, its metrics and communications will activate.</p>
              </Card>
            ) : (
              <>
                {/* PROPOSALS SECTION (Shows on Overview Tab) */}
                <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
                  {proposals.length > 0 && (
                    <div className="space-y-4 mb-6">
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <FileSignature className="h-4 w-4 text-[#ff7006]" /> Pending System Proposals
                      </h2>
                      {proposals.map((prop: any) => (
                        <Card key={prop.id} className="rounded-2xl border border-[#ff7006]/30 overflow-hidden bg-white shadow-md hover:border-[#ff7006]/40 transition-all">
                          <div className="bg-[#ff7006]/5 px-5 py-3.5 border-b border-[#ff7006]/10 flex justify-between items-center gap-3">
                            <span className="text-xs font-extrabold text-[#ff7006] uppercase tracking-wider">Action Required</span>
                            <Badge className="bg-[#ff7006] hover:bg-[#e05e00] text-white rounded-lg text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">Signature Pending</Badge>
                          </div>
                          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <h3 className="font-extrabold text-slate-850 text-base">{prop.title}</h3>
                              <p className="font-mono text-sm font-black text-slate-900 mt-1">Value: ${Number(prop.amount).toLocaleString()}</p>
                              <p className="text-xs text-slate-500 mt-2.5 line-clamp-2 leading-relaxed">{prop.content.substring(0, 100)}...</p>
                            </div>
                            <div className="flex gap-2.5 w-full sm:w-auto shrink-0 mt-3 sm:mt-0">
                              {prop.pdf_url && (
                                <Button variant="outline" className="rounded-xl h-10 px-4 text-xs font-bold bg-white border-slate-200 text-slate-650 hover:bg-slate-50 transition-all" asChild>
                                  <a href={prop.pdf_url} target="_blank" rel="noreferrer">View PDF</a>
                                </Button>
                              )}
                              <Button className="bg-[#ff7006] hover:bg-[#e05e00] text-white rounded-xl h-10 px-5 text-xs font-bold shadow-sm transition-all" onClick={() => acceptProposalMutation.mutate(prop.id)} disabled={acceptProposalMutation.isPending}>
                                {acceptProposalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSignature className="h-3.5 w-3.5 mr-2" />}
                                Accept & Sign
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Active Project Dashboard Overview */}
                  <div className="space-y-6">

                    {/* Welcome Display Block */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                      <div>
                        <h2 className="text-xl font-extrabold text-slate-900">{activeProject.project_name}</h2>
                        <p className="text-xs text-slate-500 mt-1 font-semibold flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[10px]">{activeProject.project_type}</span>
                          <span>&bull;</span>
                          <span>Live Timeline Stream</span>
                        </p>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-wider px-3 py-1 select-none shadow-sm">
                        Active Pipeline
                      </Badge>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-[#ff7006]/35 transition-all">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-slate-200 group-hover:bg-[#ff7006]" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Total Budget Value</span>
                        <span className="text-slate-800 text-2xl font-mono font-black">${Number(activeProject.total_budget).toLocaleString()}</span>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/35 transition-all">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-slate-200 group-hover:bg-emerald-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Amount Paid Ledger</span>
                        <span className="text-emerald-600 text-2xl font-mono font-black">${Number(activeProject.paid_amount).toLocaleString()}</span>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/35 transition-all">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-slate-200 group-hover:bg-amber-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Dues Remaining Balance</span>
                        <span className="text-amber-600 text-2xl font-mono font-black">${(Number(activeProject.total_budget) - Number(activeProject.paid_amount)).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Timeline Stage progress */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-[#ff7006] uppercase tracking-wider font-extrabold flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#ff7006] animate-ping" />
                          Operational Phase: {stageLabels[activeProject.stage]}
                        </span>
                        <span className="text-slate-500 font-mono">Phase {stages.indexOf(activeProject.stage) + 1} of {stages.length}</span>
                      </div>
                      <Progress value={getProgress(activeProject.stage)} className="h-2 rounded-full bg-slate-100 border border-slate-200/50" />

                      {/* Milestone timeline dots */}
                      <div className="relative pt-2 pb-4 overflow-x-auto">
                        <div className="flex justify-between text-[10px] min-w-[600px] px-1 relative">
                          <div className="absolute top-2 left-0 right-0 h-[2px] bg-slate-100 z-0 border-t border-slate-200" />
                          {stages.map((stage, idx) => {
                            const isActive = idx <= stages.indexOf(activeProject.stage);
                            const isCurrent = stage === activeProject.stage;
                            return (
                              <div key={stage} className={`flex flex-col items-center z-10 ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                                <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${isCurrent ? 'bg-[#ff7006] border-[#ff7006] ring-4 ring-[#ff7006]/20' :
                                  isActive ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'
                                  }`} />
                                <span className="mt-2.5 text-[9px] font-bold uppercase tracking-wider">{stageLabels[stage]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {activeProject.deadline && (
                      <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 bg-white px-5 py-4 rounded-2xl border border-slate-200 shadow-sm">
                        <Calendar className="h-5 w-5 text-[#ff7006]" />
                        <span>Project Targeted Production Deadline: <strong className="text-slate-800 font-extrabold">{format(new Date(activeProject.deadline), 'MMMM d, yyyy')}</strong></span>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* TEAM MESSAGING TAB */}
                <TabsContent value="messages" className="mt-0 focus-visible:outline-none">
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[560px]">
                    <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Live Thread: Technical & Management Team</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 font-mono tracking-widest">100% ENCRYPTED</span>
                    </div>

                    {/* Messages Scrollbox */}
                    <ScrollArea className="flex-1 p-5 bg-slate-50/20">
                      {messagesLoading ? (
                        <div className="flex items-center justify-center h-full py-20">
                          <Loader2 className="h-6 w-6 animate-spin text-[#ff7006]" />
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center py-20 text-slate-450 text-xs font-bold">
                          <MessageSquare className="h-10 w-10 mx-auto mb-2.5 opacity-20 text-[#ff7006]" />
                          No chat history. Start the conversation with your coordinator!
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages.map((msg) => {
                            const isMine = msg.sender_id === user?.id;
                            return (
                              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2.5`}>
                                {!isMine && (
                                  <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-[10px] text-slate-600 select-none uppercase shrink-0">
                                    TW
                                  </div>
                                )}
                                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-xs font-medium leading-relaxed ${isMine ? 'bg-[#ff7006] text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                                  <p className="whitespace-pre-wrap">{msg.message}</p>
                                  <p className="text-[9px] opacity-75 mt-1.5 text-right font-mono font-bold">
                                    {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                                  </p>
                                </div>
                                {isMine && (
                                  <div className="w-7 h-7 rounded-full bg-orange-100 border border-[#ff7006]/20 flex items-center justify-center font-bold text-[10px] text-[#ff7006] select-none uppercase shrink-0">
                                    U
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </ScrollArea>

                    {/* Input message form */}
                    <div className="p-4 border-t border-slate-200 bg-white">
                      <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                        <Input
                          placeholder="Type an operational or coordinate message directly to team..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          disabled={sendMutation.isPending}
                          className="rounded-xl border-slate-200 bg-slate-50/50 text-xs px-4 focus-visible:ring-1 focus-visible:ring-[#ff7006] focus-visible:border-[#ff7006] font-semibold h-11 flex-1 transition-all"
                        />
                        <Button type="submit" size="icon" disabled={!newMessage.trim() || sendMutation.isPending} className="bg-[#ff7006] hover:bg-[#e05e00] text-white h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-orange-500/10 transition-all">
                          {sendMutation.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </form>
                    </div>
                  </div>
                </TabsContent>

                {/* DELIVERABLES & SHARED ASSETS TAB */}
                <TabsContent value="deliverables" className="mt-0 focus-visible:outline-none space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                    <h3 className="font-extrabold text-sm text-slate-850 mb-1">Production Deliverables & Files</h3>
                    <p className="text-xs text-slate-500">Download the official code deliverables and production assets shared by the engineering team.</p>
                  </div>
                  <div className="space-y-3">
                    {deliverables.filter((d: any) => d.project_id === activeProject.id).length === 0 ? (
                      <Card className="rounded-2xl border border-slate-200 shadow-sm p-10 text-center bg-white">
                        <p className="text-slate-400 text-xs font-semibold">No assets or code packages shared yet.</p>
                      </Card>
                    ) : (
                      deliverables.filter((d: any) => d.project_id === activeProject.id).map((d: any) => (
                        <div key={d.id} className="flex justify-between items-center p-4.5 border border-slate-200/85 rounded-xl bg-white shadow-sm hover:border-[#ff7006]/30 hover:shadow-md transition-all duration-200">
                          <div className="flex items-center gap-3.5">
                            <div className="p-2.5 bg-[#ff7006]/5 rounded-xl border border-[#ff7006]/10">
                              <FileText className="h-5 w-5 text-[#ff7006]" />
                            </div>
                            <div>
                              <p className="font-bold text-xs text-slate-800">{d.title}</p>
                              <p className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">{format(new Date(d.created_at), 'PPP')}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="rounded-xl h-9 px-4 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all flex items-center justify-center shadow-sm text-xs font-bold" asChild>
                            <a href={d.file_url} target="_blank" rel="noreferrer">
                              <Download className="h-3.5 w-3.5 mr-2" /> Download
                            </a>
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* APPROVALS REQUIRED TAB */}
                <TabsContent value="approvals" className="mt-0 focus-visible:outline-none space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                    <h3 className="font-extrabold text-sm text-slate-850 mb-1">Operational Milestone Approvals</h3>
                    <p className="text-xs text-slate-500">Official sign-off workflow logs for deployment, layouts, and scope changes.</p>
                  </div>
                  {approvals.filter((a: any) => a.project_id === activeProject.id).length === 0 ? (
                    <Card className="rounded-2xl border border-slate-200 shadow-sm p-10 text-center bg-white">
                      <p className="text-slate-400 text-xs font-semibold">No milestone approval requests pending.</p>
                    </Card>
                  ) : (
                    approvals.filter((a: any) => a.project_id === activeProject.id).map((a: any) => (
                      <Card key={a.id} className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <CardContent className="p-5 sm:p-6 space-y-4">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-900">{a.title}</h4>
                              <p className="text-xs text-slate-505 mt-2 whitespace-pre-wrap leading-relaxed">{a.description}</p>
                              {a.asset_url && (
                                <a href={a.asset_url} target="_blank" className="text-xs font-bold text-[#ff7006] hover:underline mt-3 inline-flex items-center gap-1">
                                  View Reference Document File &rarr;
                                </a>
                              )}
                            </div>
                            <Badge className={`rounded-lg text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 select-none ${a.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              a.status === 'changes_requested' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                              {a.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {a.status === 'pending' && (
                            <div className="pt-4 border-t border-slate-100 mt-4 space-y-3.5">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Response Notes / Feedback</Label>
                                <Input
                                  className="rounded-xl border-slate-200 bg-slate-50/50 text-xs px-3.5 h-10 focus-visible:ring-1 focus-visible:ring-[#ff7006] focus-visible:border-[#ff7006] transition-all"
                                  placeholder="Write notes regarding the requested changes..."
                                  value={approvalFeedback[a.id] || ''}
                                  onChange={(e) => setApprovalFeedback({ ...approvalFeedback, [a.id]: e.target.value })}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider px-4 py-2 flex items-center gap-1.5" onClick={() => respondApprovalMutation.mutate({ approvalId: a.id, status: 'approved', feedback: approvalFeedback[a.id] })}>
                                  <ThumbsUp className="h-3.5 w-3.5" /> Approve Milestone
                                </Button>
                                <Button size="sm" variant="destructive" className="rounded-xl font-bold text-[10px] uppercase tracking-wider px-4 py-2" onClick={() => respondApprovalMutation.mutate({ approvalId: a.id, status: 'changes_requested', feedback: approvalFeedback[a.id] })}>
                                  Request Modifications
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* HELPDESK & SUPPORT TICKETS TAB */}
                <TabsContent value="tickets" className="mt-0 focus-visible:outline-none space-y-6">

                  {/* Grid dividing ticket creation and index */}
                  <div className="grid gap-6 md:grid-cols-5 items-start">

                    {/* File Support Ticket Form */}
                    <div className="md:col-span-2 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-4 h-fit sticky top-20">
                      <div className="border-b border-slate-200 pb-3">
                        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">Submit Support Request</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">Report critical operational blockers.</p>
                      </div>

                      <div className="space-y-3.5">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Request Subject</Label>
                          <Input placeholder="E.g. Authentication loops" value={ticketTitle} onChange={e => setTicketTitle(e.target.value)} className="rounded-xl border-slate-200 bg-white text-xs px-3.5 h-10 font-semibold focus-visible:ring-1 focus-visible:ring-[#ff7006] transition-all" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Priority Level</Label>
                          <Select value={ticketPriority} onValueChange={setTicketPriority}>
                            <SelectTrigger className="rounded-xl border-slate-200 bg-white text-xs px-3.5 h-10 font-semibold focus:ring-1 focus:ring-[#ff7006]">
                              <SelectValue placeholder="Priority Level" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 bg-white shadow-xl">
                              <SelectItem value="low" className="text-xs font-semibold py-2">Low Priority</SelectItem>
                              <SelectItem value="medium" className="text-xs font-semibold py-2">Medium Priority</SelectItem>
                              <SelectItem value="high" className="text-xs font-semibold py-2 font-bold">High Priority</SelectItem>
                              <SelectItem value="urgent" className="text-xs font-semibold py-2 text-rose-600 font-bold">Urgent Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Describe Issue</Label>
                          <Input placeholder="Provide absolute details regarding request..." value={ticketDesc} onChange={e => setTicketDesc(e.target.value)} className="rounded-xl border-slate-200 bg-white text-xs px-3.5 h-10 font-semibold focus-visible:ring-1 focus-visible:ring-[#ff7006] transition-all" />
                        </div>

                        <Button size="sm" className="bg-[#ff7006] hover:bg-[#e05e00] text-white rounded-xl font-bold text-[10px] uppercase tracking-wider w-full py-2.5 h-10 shadow-sm" disabled={!ticketTitle || createTicketMutation.isPending} onClick={() => createTicketMutation.mutate({ projectId: activeProject.id })}>
                          <LifeBuoy className="h-4 w-4 mr-2" /> File Support Ticket
                        </Button>
                      </div>
                    </div>

                    {/* Past Tickets Index */}
                    <div className="md:col-span-3 space-y-3.5">
                      <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                        <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">Support Ticket Index</h4>
                        <span className="text-[10px] font-bold text-slate-500 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          {tickets.filter((t: any) => t.project_id === activeProject.id).length} Submissions
                        </span>
                      </div>

                      {tickets.filter((t: any) => t.project_id === activeProject.id).length === 0 ? (
                        <Card className="rounded-2xl border border-slate-200/80 shadow-sm p-10 text-center bg-white">
                          <p className="text-slate-400 text-xs font-semibold">No support requests filed for this project.</p>
                        </Card>
                      ) : (
                        tickets.filter((t: any) => t.project_id === activeProject.id).map((t: any) => (
                          <div key={t.id} className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-3 hover:border-slate-300 transition-all">
                            <div className="flex justify-between font-bold items-center gap-3">
                              <span className="text-slate-800 text-xs font-extrabold">{t.title}</span>
                              <Badge className={`rounded-lg text-[9px] font-bold uppercase px-2 py-0.5 select-none ${t.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}>{t.status}</Badge>
                            </div>
                            <p className="text-slate-500 text-xs leading-relaxed whitespace-pre-wrap">{t.description}</p>
                            {t.resolution_notes && (
                              <div className="bg-emerald-50/70 text-emerald-800 p-3.5 rounded-xl text-[11px] mt-2.5 border border-emerald-100 whitespace-pre-wrap leading-relaxed font-medium">
                                <strong className="text-emerald-900 block mb-1">Resolution Response Notes:</strong> {t.resolution_notes}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                  </div>
                </TabsContent>

                {/* BILLING & UPDATES TAB */}
                <TabsContent value="billing" className="mt-0 focus-visible:outline-none space-y-6">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                    <h3 className="font-extrabold text-sm text-slate-850 mb-1">Billing & Project Logs</h3>
                    <p className="text-xs text-slate-500">Track paid invoices, current balances, and real-time operational updates shared by your manager.</p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">

                    {/* Operational updates */}
                    <Card className="rounded-2xl border border-slate-200/85 bg-white shadow-sm overflow-hidden">
                      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                          <MessageSquare className="h-4.5 w-4.5 text-[#ff7006]" />
                          Operational Pipeline Updates
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        {updates.length === 0 ? (
                          <p className="text-xs text-slate-400 font-semibold text-center py-4">No recent development logs.</p>
                        ) : (
                          updates.map((update) => (
                            <div key={update.id} className="border-l-2 border-[#ff7006] pl-4 py-1 relative">
                              <p className="font-extrabold text-xs text-slate-800">{update.title}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{update.message}</p>
                              <p className="text-[9px] text-slate-400 font-mono font-bold mt-2">
                                {format(new Date(update.created_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {/* Ledger invoices index */}
                    <Card className="rounded-2xl border border-slate-200/85 bg-white shadow-sm overflow-hidden">
                      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                          <FileText className="h-4.5 w-4.5 text-[#ff7006]" />
                          Invoices Ledger
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-4">
                        {invoices.length === 0 ? (
                          <p className="text-xs text-slate-400 font-semibold text-center py-4">No invoices billed to this workspace.</p>
                        ) : (
                          invoices.map((invoice) => (
                            <div key={invoice.id} className="flex items-center justify-between gap-3 p-3 border border-slate-200/80 rounded-xl bg-slate-50/40 hover:border-slate-300 transition-all">
                              <div>
                                <p className="font-extrabold text-xs text-slate-800">{invoice.invoice_number}</p>
                                <p className="text-[11px] text-[#ff7006] font-mono font-bold mt-0.5">
                                  ${Number(invoice.total_amount).toLocaleString()}
                                </p>
                              </div>
                              <Badge className={`rounded-lg text-[9px] font-bold uppercase px-2 py-0.5 select-none ${invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-550 border border-slate-200'}`}>
                                {invoice.status}
                              </Badge>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                  </div>
                </TabsContent>
              </>
            )}

          </main>
        </div>

      </Tabs>
    </div>
  );
}