/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useMemo } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  FileSignature,
  AlertTriangle,
  Plus,
  CalendarDays,
  User,
  ShieldCheck,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';
import html2pdf from 'html2pdf.js';
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
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get('project');
  const queryTab = searchParams.get('tab');

  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState(queryTab || 'overview');
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const pdfRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && (!user || role !== 'client')) {
      navigate('/auth');
    }
  }, [user, role, loading, navigate]);

  // Fetch profiles table for user client information
  const { data: profile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

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
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].id);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    if (queryProjectId && projects.length > 0) {
      setSelectedProject(queryProjectId);
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
      const { data, error } = await supabase
        .from('proposals' as any)
        .select('*')
        .eq('client_id', user?.id)
        .eq('status', 'sent')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: ['client-deliverables', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase
        .from('project_deliverables' as any)
        .select('*')
        .in('project_id', projects.map(p => p.id))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: projects.length > 0,
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ['client-approvals', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase
        .from('project_approvals' as any)
        .select('*')
        .in('project_id', projects.map(p => p.id))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: projects.length > 0,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['client-tickets', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase
        .from('client_tickets' as any)
        .select('*')
        .in('project_id', projects.map(p => p.id))
        .order('created_at', { ascending: false });
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

  // Scroll to bottom when messages change or active tab switches to messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // --- PDF Export for invoices (client-facing) ---
  const handleDownloadInvoice = (invoice: Invoice) => {
    setPdfInvoice(invoice);
    // give React a moment to render the hidden invoice element
    setTimeout(() => {
      if (!pdfRef.current) return;
      const element = pdfRef.current as HTMLElement;
      const opt = {
        margin: 0,
        filename: invoice.invoice_number ? `Invoice-${invoice.invoice_number}.pdf` : 'invoice.pdf',
        image: { type: 'png' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      } as any;
      try {
        html2pdf().set(opt).from(element).save();
        toast.success('Preparing invoice PDF...');
      } catch (err) {
        console.error('Invoice PDF generation failed', err);
        toast.error('Failed to generate PDF');
      }
    }, 120);
  };

  useEffect(() => {
    if (activeWorkspaceTab === 'messages') {
      const timer = setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeWorkspaceTab]);

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

  const initials = useMemo(() => {
    return (profile?.full_name || user?.email || 'C')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [profile, user]);

  if (loading || projectsLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff7006]" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing client portal node...</p>
      </div>
    );
  }

  const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_budget), 0);
  const totalPaid = projects.reduce((sum, p) => sum + Number(p.paid_amount), 0);
  const pendingAmount = totalBudget - totalPaid;

  const activeProject = projects.find(p => p.id === selectedProject) || projects[0] || null;

  return (
    <div className="min-h-screen bg-background flex flex-col lg:overflow-hidden lg:h-screen">
      {/* GLOWING APP HEADER */}
      <header className="border-b bg-white/60 dark:bg-slate-900/60 border-border/50 backdrop-blur-xl shrink-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1">
              <img src="/White_bg-removebg-preview.png" className="h-10 w-auto object-contain" alt="TechWisdom Logo" />
            </div>
            <div>
              <span className="font-black text-slate-800 dark:text-white text-base tracking-tight">TechWisdom ERP</span>
              <p className="text-xs text-slate-500 font-semibold leading-none mt-1">Client Desk Console</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4.5">
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={handleSignOut} className="font-bold text-xs border-border/60 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl h-9">
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* INDEPENDENTLY SCROLLING WORKSPACE GRID (FITS VIEWPORT EXACTLY ON DESKTOP) */}
      <main className="container mx-auto px-6 py-6 flex-1 min-h-0 lg:overflow-hidden flex flex-col lg:flex-row gap-6">
        {/* Hidden invoice template for client PDF export */}
        {pdfInvoice && (
          <div ref={pdfRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px', background: '#fff', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>TechWisdom ERP</h2>
                <p style={{ margin: '4px 0', fontSize: 12 }}>Invoice</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 12 }}>Invoice #: {pdfInvoice.invoice_number}</p>
                <p style={{ margin: 0, fontSize: 12 }}>Status: {pdfInvoice.status}</p>
              </div>
            </div>

            <hr style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>Billed To</p>
                <p style={{ margin: '4px 0', fontSize: 12 }}>{pdfInvoice.client_name}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 12 }}>Date: {pdfInvoice.created_at ? format(new Date(pdfInvoice.created_at), 'PPP') : ''}</p>
                <p style={{ margin: 0, fontSize: 12 }}>Due: {pdfInvoice.due_date ? format(new Date(pdfInvoice.due_date), 'PPP') : 'N/A'}</p>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: 6 }}>Description</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', paddingBottom: 6 }}>Qty</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', paddingBottom: 6 }}>Price</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', paddingBottom: 6 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(pdfInvoice.items) ? pdfInvoice.items as any[] : []).map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ paddingTop: 8 }}>{it.description}</td>
                      <td style={{ paddingTop: 8, textAlign: 'right' }}>{it.quantity}</td>
                      <td style={{ paddingTop: 8, textAlign: 'right' }}>{Number(it.price).toLocaleString()}</td>
                      <td style={{ paddingTop: 8, textAlign: 'right' }}>{Number(it.price * it.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <div style={{ width: 240 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>Subtotal</div>
                    <div>{Number(pdfInvoice.total_amount).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 8 }}>
                    <div>Total</div>
                    <div>{Number(pdfInvoice.total_amount).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>

            {pdfInvoice.notes && <div style={{ marginTop: 18 }}><strong>Notes:</strong><p>{pdfInvoice.notes}</p></div>}
          </div>
        )}

        
        {/* LEFT COLUMN: CLIENT PROFILE & STATS SUMMARY (SCROLLS INDEPENDENTLY) */}
        <div className="w-full lg:w-[320px] shrink-0 lg:overflow-y-auto lg:max-h-full scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] space-y-6 pb-6">
          
          {/* PROFILE SUMMARY GLOW CARD */}
          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-r from-[#ff7006]/10 via-amber-500/10 to-indigo-500/10" />
            <CardContent className="pt-10 flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 text-xl border-4 border-white dark:border-slate-900 shadow-md">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-[#ff7006] text-white font-extrabold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-lg font-black text-slate-800 dark:text-white mt-3 leading-snug">
                {profile?.full_name || user?.email?.split('@')[0] || 'Client Partner'}
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-1">Corporate Representative</p>
              
              <Badge className="mt-3 rounded-lg bg-emerald-500/10 text-emerald-600 border-none font-bold text-xs py-0.5 px-2.5 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Verified Partner
              </Badge>
            </CardContent>
          </Card>

          {/* PROJECT SELECTOR CARD */}
          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold text-slate-500">Select Project Node</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-xs text-slate-400 font-bold py-2.5 text-center">
                  No active projects assigned
                </div>
              ) : (
                <Select value={selectedProject || ''} onValueChange={(val) => setSelectedProject(val)}>
                  <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-950 border-border hover:border-slate-400 dark:hover:border-slate-700 h-10 font-bold text-xs rounded-xl text-slate-700 dark:text-slate-200 transition-all focus:ring-1 focus:ring-[#ff7006] focus:border-[#ff7006]">
                    <SelectValue placeholder="Select project node" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-950 border-border rounded-xl shadow-2xl">
                    {projects.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id} className="text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">
                        {proj.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* FINANCIAL HEALTH LEDGER */}
          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-[#ff7006]" /> Financial Standing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-400">Total Billed Value</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">${totalBudget.toLocaleString()}</span>
              </div>
              <Separator className="border-border/30" />
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-400">Total Payments Sent</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">${totalPaid.toLocaleString()}</span>
              </div>
              <Separator className="border-border/30" />
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-400">Dues Outstanding</span>
                <span className="font-mono text-amber-600 dark:text-amber-500">${pendingAmount.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* RIGHT COLUMN: WORKSPACE TAB PANELS (SCROLLS INDEPENDENTLY WITH WRAPPING TABS) */}
        <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden">
          
          <Tabs value={activeWorkspaceTab} onValueChange={setActiveWorkspaceTab} className="h-full flex flex-col min-h-0">
            
            {/* TABS TRIGGER ROW (WRAPS BEAUTIFULLY OVER TWO LINES) */}
            <div className="w-full bg-white/60 dark:bg-slate-900/60 border border-border/60 backdrop-blur-xl p-3 rounded-2xl shadow-lg shrink-0 mb-4">
              <TabsList className="bg-transparent border-0 flex flex-wrap gap-2 h-auto p-0 justify-start select-none w-full">
                <TabsTrigger value="overview" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-205">
                  <FolderKanban className="h-4 w-4" /> Project Dashboard
                </TabsTrigger>
                <TabsTrigger value="messages" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-205">
                  <MessageSquare className="h-4 w-4" /> Team Messaging
                </TabsTrigger>
                <TabsTrigger value="deliverables" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-205">
                  <FileText className="h-4 w-4" /> Shared Assets
                </TabsTrigger>
                <TabsTrigger value="approvals" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-205">
                  <CheckCircle2 className="h-4 w-4" /> Approvals Required
                </TabsTrigger>
                <TabsTrigger value="tickets" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-205">
                  <LifeBuoy className="h-4 w-4" /> Support & Helpdesk
                </TabsTrigger>
                <TabsTrigger value="billing" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-[#ff7006] data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-205">
                  <DollarSign className="h-4 w-4" /> Billing & Updates
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB CONTENTS (SCROLLABLE INDEPENDENTLY WITH ZERO SCROLLBARS ON DESKTOP) */}
            <div className={`flex-1 min-h-0 ${activeWorkspaceTab === 'messages' ? 'overflow-hidden flex flex-col' : 'lg:overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]'} pb-6`}>
              
              {!activeProject ? (
                <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl p-16 text-center">
                  <FolderKanban className="h-14 w-14 mx-auto text-slate-400 mb-4 animate-pulse" />
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">No active projects assigned</h3>
                  <p className="text-xs text-slate-550 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                    Once your development coordinator assigns a project to this client token, its active metrics and staging pipelines will display.
                  </p>
                </Card>
              ) : (
                <>
                  {/* TAB: PROJECT DASHBOARD */}
                  <TabsContent value="overview" className="m-0 focus-visible:outline-none space-y-6">
                    
                    {/* Pending Proposals Section */}
                    {proposals.length > 0 && (
                      <div className="space-y-4">
                        <h2 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                          <FileSignature className="h-4 w-4 text-[#ff7006]" /> Action Required: Pending System Agreements
                        </h2>
                        {proposals.map((prop: any) => (
                          <Card key={prop.id} className="rounded-2xl border border-[#ff7006]/30 overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg hover:border-[#ff7006]/50 transition-all">
                            <div className="bg-[#ff7006]/5 px-5 py-3 border-b border-[#ff7006]/10 flex justify-between items-center gap-3">
                              <span className="text-xs font-bold text-[#ff7006]">Awaiting Signature</span>
                              <Badge className="bg-[#ff7006] text-white rounded-lg text-xs font-bold px-2 py-0.5">Signature Needed</Badge>
                            </div>
                            <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-extrabold text-sm text-slate-850 dark:text-slate-200 leading-snug">{prop.title}</h3>
                                <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">Contract Value: ${Number(prop.amount).toLocaleString()}</p>
                                <p className="text-2xs font-semibold text-slate-500 mt-2 line-clamp-2 leading-relaxed">{prop.content}</p>
                              </div>
                              <div className="flex gap-2.5 w-full md:w-auto shrink-0 mt-3 md:mt-0">
                                {prop.pdf_url && (
                                  <Button variant="outline" className="rounded-xl h-9 px-4 text-xs font-bold border-border/60 bg-white/50 dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-slate-900" asChild>
                                    <a href={prop.pdf_url} target="_blank" rel="noreferrer">View PDF</a>
                                  </Button>
                                )}
                                <Button className="bg-[#ff7006] hover:bg-[#ff7006]/90 text-white rounded-xl h-9 px-5 text-xs font-bold shadow-md shadow-orange-500/10" onClick={() => acceptProposalMutation.mutate(prop.id)} disabled={acceptProposalMutation.isPending}>
                                  {acceptProposalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <FileSignature className="h-3.5 w-3.5 mr-1.5" />}
                                  Sign Agreement
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Active Project Dashboard Overview */}
                    <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                      <CardHeader className="pb-3 border-b border-border/40">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <CardTitle className="text-base font-bold text-slate-805 dark:text-slate-200">{activeProject.project_name}</CardTitle>
                            <CardDescription className="text-xs text-slate-500 mt-1">
                              {activeProject.project_type} | Staging Pipeline
                            </CardDescription>
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-none rounded-lg text-xs font-bold py-0.5 px-2.5">
                            Operational Phase
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-6 space-y-6">
                        {/* Phase Progress Bar */}
                        <div className="space-y-3.5 bg-slate-50/50 dark:bg-slate-950/10 border border-border/40 p-4.5 rounded-2xl">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-[#ff7006] font-bold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#ff7006] animate-ping" />
                              Active Phase: {stageLabels[activeProject.stage]}
                            </span>
                            <span className="text-slate-405 font-mono text-xs">Phase {stages.indexOf(activeProject.stage) + 1} of {stages.length}</span>
                          </div>
                          <Progress value={getProgress(activeProject.stage)} className="h-2 rounded-full bg-slate-100 dark:bg-slate-950 border border-border/40" />

                          {/* Milestone Steps Timeline */}
                          <div className="relative pt-2 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
                            <div className="flex justify-between text-xs min-w-[650px] px-1 relative">
                              <div className="absolute top-2 left-0 right-0 h-[1.5px] bg-border/55 z-0" />
                              {stages.map((stage, idx) => {
                                const isActive = idx <= stages.indexOf(activeProject.stage);
                                const isCurrent = stage === activeProject.stage;
                                return (
                                  <div key={stage} className={`flex flex-col items-center z-10 ${isActive ? 'text-slate-800 dark:text-slate-205' : 'text-slate-400'}`}>
                                    <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all flex items-center justify-center ${
                                      isCurrent ? 'bg-[#ff7006] border-[#ff7006] ring-4 ring-[#ff7006]/20' :
                                      isActive ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-900 border-border'
                                    }`} />
                                    <span className="mt-2 text-[10px] font-semibold text-slate-500">{stageLabels[stage]}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Project Details Footer */}
                        {activeProject.deadline && (
                          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 border border-border/50 p-4.5 rounded-2xl bg-white/40 dark:bg-slate-950/20">
                            <Calendar className="h-4.5 w-4.5 text-[#ff7006]" />
                            <span>Target Production Deadline: <strong className="text-slate-700 dark:text-slate-300 font-extrabold">{format(new Date(activeProject.deadline), 'MMMM d, yyyy')}</strong></span>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                  </TabsContent>

                  {/* TAB: TEAM MESSAGING */}
                  <TabsContent value="messages" className="m-0 focus-visible:outline-none flex-1 h-full flex flex-col min-h-0 data-[state=inactive]:hidden">
                    <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden flex flex-col flex-1 h-full min-h-0">
                      <CardHeader className="pb-3 border-b border-border/40 bg-slate-50/50 dark:bg-slate-950/20 py-3.5 flex flex-row items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <CardTitle className="text-xs font-bold text-slate-500">Live Thread: Technical Coordinators</CardTitle>
                        </div>
                        <Badge className="bg-[#ff7006]/10 text-[#ff7006] border-none text-[10px] font-bold py-0.5 px-2.5">Staging Secure</Badge>
                      </CardHeader>

                      <div ref={chatContainerRef} className="flex-1 p-5 overflow-y-auto bg-slate-50/20 dark:bg-slate-950/5 space-y-4 min-h-0 scrollbar-thin">
                        {messagesLoading ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-[#ff7006]" />
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="text-center py-20 text-slate-400 text-xs font-semibold">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30 text-[#ff7006]" />
                            No chat history. Start the conversation with your coordinator!
                          </div>
                        ) : (
                          messages.map((msg) => {
                            const isMine = msg.sender_id === user?.id;
                            return (
                              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2.5`}>
                                {!isMine && (
                                  <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-[10px] text-indigo-500 uppercase shrink-0 select-none">
                                    TW
                                  </div>
                                )}
                                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-xs font-medium leading-relaxed ${
                                  isMine ? 'bg-[#ff7006] text-white rounded-tr-none' : 'bg-white dark:bg-slate-900 border border-border/80 text-slate-800 dark:text-slate-200 rounded-tl-none'
                                }`}>
                                  <p className="whitespace-pre-wrap">{msg.message}</p>
                                  <p className="text-[9px] opacity-75 mt-1.5 text-right font-mono font-bold">
                                    {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                                  </p>
                                </div>
                                {isMine && (
                                  <div className="w-7 h-7 rounded-full bg-orange-500/10 border border-[#ff7006]/20 flex items-center justify-center font-black text-[10px] text-[#ff7006] uppercase shrink-0 select-none">
                                    U
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      <div className="p-4 border-t border-border/40 bg-white/80 dark:bg-slate-900/80 shrink-0">
                        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                          <Input
                            placeholder="Type an operational message to managers..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            disabled={sendMutation.isPending}
                            className="rounded-xl border-border bg-slate-50/50 dark:bg-slate-950/20 text-xs px-4 focus-visible:ring-1 focus-visible:ring-[#ff7006] focus-visible:border-[#ff7006] font-semibold h-11 flex-1 transition-all"
                          />
                          <Button type="submit" size="icon" disabled={!newMessage.trim() || sendMutation.isPending} className="bg-[#ff7006] hover:bg-[#ff7006]/90 text-white h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-orange-500/10 transition-all">
                            {sendMutation.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </form>
                      </div>
                    </Card>
                  </TabsContent>

                  {/* TAB: SHARED DELIVERABLES */}
                  <TabsContent value="deliverables" className="m-0 focus-visible:outline-none space-y-4">
                    <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                      <CardHeader className="pb-3 border-b border-border/40">
                        <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-880 dark:text-slate-205">
                          <FileText className="h-5 w-5 text-[#ff7006]" /> Deliverable Vault & Shared Assets
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          Download official code deliverables, systems architecture specifications, and builds shared by our engineering core.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6 px-6">
                        {deliverables.filter((d: any) => d.project_id === activeProject.id).length === 0 ? (
                          <div className="text-center py-10 text-slate-400">No deliverable assets uploaded yet.</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {deliverables.filter((d: any) => d.project_id === activeProject.id).map((d: any) => (
                              <div key={d.id} className="flex items-center justify-between gap-4 p-4 border border-border/50 rounded-2xl bg-white/40 dark:bg-slate-950/20 hover:scale-[0.99] transition-all min-w-0">
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                  <div className="h-10 w-10 bg-[#ff7006]/10 text-[#ff7006] rounded-xl flex items-center justify-center shrink-0">
                                    <FileText className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 flex-1 overflow-hidden">
                                    <h4 className="font-extrabold text-xs text-slate-850 dark:text-slate-200 truncate leading-tight">{d.title}</h4>
                                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                                      <span>Uploaded: {format(new Date(d.created_at), 'MMM dd, yyyy')}</span>
                                    </div>
                                  </div>
                                </div>
                                <Button size="sm" variant="outline" className="rounded-xl h-8 px-3 border-border/60 hover:bg-slate-50 dark:hover:bg-slate-950/20 shrink-0 shadow-sm text-2xs font-bold" asChild>
                                  <a href={d.file_url} target="_blank" rel="noreferrer">
                                    <Download className="h-3.5 w-3.5 mr-1" /> Get File
                                  </a>
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* TAB: APPROVALS REQUIRED */}
                  <TabsContent value="approvals" className="m-0 focus-visible:outline-none space-y-4">
                    <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                      <CardHeader className="pb-3 border-b border-border/40">
                        <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-880 dark:text-slate-205">
                          <CheckCircle2 className="h-5 w-5 text-indigo-500" /> Milestone Approvals Required
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          Provide official corporate sign-off or request layouts alignment and adjustments before deployment runs.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6 px-6 space-y-4">
                        {approvals.filter((a: any) => a.project_id === activeProject.id).length === 0 ? (
                          <div className="text-center py-10 text-slate-400">No pending milestones awaiting review.</div>
                        ) : (
                          approvals.filter((a: any) => a.project_id === activeProject.id).map((a: any) => (
                            <div key={a.id} className="p-5 border border-border/50 rounded-2xl bg-white/40 dark:bg-slate-950/20 space-y-4">
                              <div className="flex justify-between items-start gap-4">
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-extrabold text-sm text-slate-850 dark:text-slate-200">{a.title}</h4>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 whitespace-pre-wrap leading-relaxed">{a.description}</p>
                                  {a.asset_url && (
                                    <a href={a.asset_url} target="_blank" className="text-xs font-bold text-[#ff7006] hover:underline mt-3 inline-flex items-center gap-1">
                                      View Reference Document &rarr;
                                    </a>
                                  )}
                                </div>
                                <Badge className={`rounded-lg text-xs font-bold px-2.5 py-0.5 select-none ${
                                  a.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border-none' :
                                  a.status === 'changes_requested' ? 'bg-rose-500/10 text-rose-600 border-none' :
                                  'bg-amber-500/10 text-amber-600 border-none'
                                }`}>
                                  {a.status.replace('_', ' ')}
                                </Badge>
                              </div>

                              {a.status === 'pending' && (
                                <div className="pt-4 border-t border-border/40 space-y-3 mt-2">
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Approval Response Notes</Label>
                                    <Input
                                      className="rounded-xl border-border bg-slate-50/50 dark:bg-slate-950/20 text-xs px-3.5 h-10 focus-visible:ring-1 focus-visible:ring-[#ff7006] focus-visible:border-[#ff7006] transition-all"
                                      placeholder="Provide context or specify required design adjustments..."
                                      value={approvalFeedback[a.id] || ''}
                                      onChange={(e) => setApprovalFeedback({ ...approvalFeedback, [a.id]: e.target.value })}
                                    />
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider px-4 h-9 flex items-center gap-1.5" onClick={() => respondApprovalMutation.mutate({ approvalId: a.id, status: 'approved', feedback: approvalFeedback[a.id] })}>
                                      <ThumbsUp className="h-3.5 w-3.5" /> Sign-off Milestone
                                    </Button>
                                    <Button size="sm" variant="destructive" className="rounded-xl font-bold text-[10px] uppercase tracking-wider px-4 h-9" onClick={() => respondApprovalMutation.mutate({ approvalId: a.id, status: 'changes_requested', feedback: approvalFeedback[a.id] })}>
                                      Request Modifications
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* TAB: SUPPORT & HELPDESK */}
                  <TabsContent value="tickets" className="m-0 focus-visible:outline-none space-y-6">
                    <div className="grid gap-6 lg:grid-cols-5 items-start">
                      
                      {/* Ticket submission form */}
                      <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden lg:col-span-2 sticky top-0">
                        <CardHeader className="pb-3 border-b border-border/40">
                          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-805 dark:text-slate-205">
                            <LifeBuoy className="h-4.5 w-4.5 text-[#ff7006]" /> Submit Ticket Call
                          </CardTitle>
                          <CardDescription className="text-2xs font-semibold text-slate-450 uppercase tracking-wide mt-1">
                            Report issues or blockers directly to managers.
                          </CardDescription>
                        </CardHeader>
                        
                        <CardContent className="pt-6 space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Request Subject</Label>
                            <Input
                              placeholder="E.g. API Rotation Errors"
                              value={ticketTitle}
                              onChange={(e) => setTicketTitle(e.target.value)}
                              className="rounded-xl border-border bg-white dark:bg-slate-950 text-xs px-3.5 h-10 font-bold focus-visible:ring-1 focus-visible:ring-[#ff7006] focus-visible:border-[#ff7006] transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Priority Level</Label>
                            <Select value={ticketPriority} onValueChange={setTicketPriority}>
                              <SelectTrigger className="rounded-xl border-border bg-white dark:bg-slate-950 text-xs px-3.5 h-10 font-bold focus:ring-1 focus:ring-[#ff7006] focus:border-[#ff7006]">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-slate-950 border-border rounded-xl">
                                <SelectItem value="low" className="text-xs font-bold">Low Priority</SelectItem>
                                <SelectItem value="medium" className="text-xs font-bold">Medium Priority</SelectItem>
                                <SelectItem value="high" className="text-xs font-bold">High Priority</SelectItem>
                                <SelectItem value="urgent" className="text-xs font-black text-rose-500">Urgent Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Details / Logs</Label>
                            <textarea
                              placeholder="Please outline the console details, steps to replicate, or server headers..."
                              value={ticketDesc}
                              onChange={(e) => setTicketDesc(e.target.value)}
                              className="rounded-xl border border-border bg-white dark:bg-slate-950 text-xs p-3.5 min-h-[110px] w-full font-semibold focus:ring-1 focus:ring-[#ff7006] focus:border-[#ff7006] outline-none transition-all resize-none leading-relaxed"
                            />
                          </div>

                          <Button
                            className="bg-[#ff7006] hover:bg-[#ff7006]/90 text-white rounded-xl font-bold text-xs uppercase tracking-wider w-full h-11 shadow-md shadow-orange-500/10"
                            disabled={!ticketTitle || !ticketDesc || createTicketMutation.isPending}
                            onClick={() => createTicketMutation.mutate({ projectId: activeProject.id })}
                          >
                            {createTicketMutation.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin mr-1.5" /> : <LifeBuoy className="h-4 w-4 mr-2" />}
                            Submit Request
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Ticket History Index */}
                      <div className="lg:col-span-3 space-y-4">
                        <div className="bg-white/60 dark:bg-slate-900/60 border border-border/60 p-4.5 rounded-2xl flex items-center justify-between shadow-sm">
                          <span className="text-sm font-bold text-slate-600">Support History</span>
                          <Badge className="bg-[#ff7006]/10 text-[#ff7006] border-none rounded-lg text-xs font-bold px-2 py-0.5">
                            {tickets.filter((t: any) => t.project_id === activeProject.id).length} Active Tickets
                          </Badge>
                        </div>

                        {tickets.filter((t: any) => t.project_id === activeProject.id).length === 0 ? (
                          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl p-16 text-center">
                            <LifeBuoy className="h-8 w-8 text-slate-350 mx-auto mb-3 animate-bounce" />
                            <h4 className="font-extrabold text-sm text-slate-805 dark:text-slate-205">No helpdesk calls filed</h4>
                            <p className="text-2xs font-semibold text-slate-405 mt-1.5 max-w-xs mx-auto leading-relaxed">
                              You have no reported bugs or support requests on record for this active workspace node.
                            </p>
                          </Card>
                        ) : (
                          <div className="space-y-3.5">
                            {tickets.filter((t: any) => t.project_id === activeProject.id).map((t: any) => {
                              const pStyles: Record<string, string> = {
                                urgent: "bg-rose-500/10 text-rose-650 border-none font-black",
                                high: "bg-orange-500/10 text-orange-655 border-none font-bold",
                                medium: "bg-blue-500/10 text-blue-655 border-none font-bold",
                                low: "bg-slate-500/10 text-slate-655 border-none font-bold"
                              };

                              const sStyles: Record<string, string> = {
                                resolved: "bg-emerald-500/10 text-emerald-650 border-none font-bold",
                                open: "bg-indigo-500/10 text-indigo-650 border-none font-bold",
                                in_progress: "bg-amber-500/10 text-amber-650 border-none font-bold",
                                closed: "bg-slate-500/10 text-slate-450 border-none font-bold"
                              };

                              return (
                                <div key={t.id} className="p-5 border border-border/55 rounded-2xl bg-white/40 dark:bg-slate-950/20 shadow-sm space-y-3.5 hover:scale-[0.99] transition-all">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-slate-805 dark:text-slate-200 text-sm font-extrabold">{t.title}</span>
                                      <Badge variant="outline" className={`h-5 rounded-lg px-2 text-xs font-bold ${pStyles[t.priority] || pStyles.medium}`}>
                                        {t.priority === 'urgent' && <AlertTriangle className="h-2.5 w-2.5 mr-0.5 animate-bounce" />}
                                        {t.priority}
                                      </Badge>
                                    </div>
                                    <Badge className={`rounded-lg text-xs font-bold py-0.5 px-2.5 ${sStyles[t.status] || sStyles.open}`}>
                                      {t.status.replace('_', ' ')}
                                    </Badge>
                                  </div>

                                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{t.description}</p>
                                  
                                  <div className="text-xs text-slate-400 font-mono font-bold flex items-center gap-1 select-none">
                                    <Calendar className="h-3.5 w-3.5 opacity-60" /> Filed: {format(new Date(t.created_at), 'MMM dd, yyyy')}
                                  </div>

                                  {t.resolution_notes && (
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl text-xs font-semibold leading-relaxed">
                                      <strong className="block text-xs font-black text-emerald-700 dark:text-emerald-350 mb-1">Resolution Response</strong>
                                      "{t.resolution_notes}"
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* TAB: BILLING & UPDATES */}
                  <TabsContent value="billing" className="m-0 focus-visible:outline-none space-y-6">
                    
                    <div className="grid gap-6 md:grid-cols-2">
                      
                      {/* Updates Ledger */}
                      <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                        <CardHeader className="pb-3 border-b border-border/40 bg-slate-50/50 dark:bg-slate-950/20 py-3.5">
                          <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4 text-[#ff7006]" /> Staging System Logs
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4.5 px-6">
                          {updates.length === 0 ? (
                            <p className="text-xs text-slate-400 font-semibold text-center py-4">No recent development logs.</p>
                          ) : (
                            updates.map((update) => (
                              <div key={update.id} className="border-l-2 border-[#ff7006] pl-4 py-1.5 relative">
                                <p className="font-extrabold text-xs text-slate-800 dark:text-slate-205">{update.title}</p>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{update.message}</p>
                                <p className="text-[10px] text-slate-400 font-mono font-bold mt-2.5">
                                  {format(new Date(update.created_at), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      {/* Invoices Billed */}
                      <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                        <CardHeader className="pb-3 border-b border-border/40 bg-slate-50/50 dark:bg-slate-950/20 py-3.5">
                          <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4 text-emerald-500" /> Billed Invoices Ledger
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-3.5 px-6">
                          {invoices.length === 0 ? (
                            <p className="text-xs text-slate-400 font-semibold text-center py-4">No invoices mapped to this workspace.</p>
                          ) : (
                            invoices.map((invoice) => (
                              <div key={invoice.id} className="flex items-center justify-between gap-3 p-3.5 border border-border/55 rounded-xl bg-white/40 dark:bg-slate-950/25 hover:scale-[0.99] transition-all">
                                <div>
                                  <p className="font-extrabold text-xs text-slate-800 dark:text-slate-205">{invoice.invoice_number}</p>
                                  <p className="text-xs text-[#ff7006] font-mono font-extrabold mt-0.5">
                                    ${Number(invoice.total_amount).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                <Badge className={`rounded-lg text-xs font-bold px-2.5 py-0.5 select-none ${
                                  invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-none' : 'bg-amber-500/10 text-amber-600 border-none'
                                }`}>
                                  {invoice.status}
                                </Badge>
                                <Button size="sm" variant="ghost" onClick={() => handleDownloadInvoice(invoice)}>
                                  <Download className="h-4 w-4 mr-1" />
                                  PDF
                                </Button>
                              </div>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                    </div>
                  </TabsContent>
                </>
              )}

            </div>

          </Tabs>
        </div>

      </main>
    </div>
  );
}