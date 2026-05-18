import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Monitor, 
  AlertTriangle, 
  Filter, 
  MessageSquare, 
  Users, 
  Globe, 
  Activity, 
  Tag, 
  ChevronRight, 
  CalendarDays, 
  Check, 
  Ticket 
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications } from '@/hooks/useNotifications';

const PRIORITY_STYLES: Record<string, { badge: string; text: string; bg: string }> = {
  urgent: {
    badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-bold",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500"
  },
  high: {
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 font-semibold",
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500"
  },
  medium: {
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-semibold",
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500"
  },
  low: {
    badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 font-semibold",
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500"
  }
};

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  open: {
    badge: "border-indigo-500/20 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 font-semibold",
    dot: "bg-indigo-500 animate-pulse"
  },
  in_progress: {
    badge: "border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/5 font-semibold",
    dot: "bg-amber-500"
  },
  resolved: {
    badge: "border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-semibold",
    dot: "bg-emerald-500"
  },
  closed: {
    badge: "border-slate-500/20 text-slate-500 dark:text-slate-400 bg-slate-500/5 font-semibold",
    dot: "bg-slate-500"
  }
};

export default function HelpdeskAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [newStatus, setNewStatus] = useState('open');
  const [newPriority, setNewPriority] = useState('medium');
  const [newCategory, setNewCategory] = useState('other');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('internal');

  // Fetch all tickets with user profiles
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: async () => {
      // Get internal IT tickets
      const { data: itData, error: itError } = await supabase
        .from('it_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (itError) throw itError;

      // Get client tickets
      const { data: clientData, error: clientError } = await supabase
        .from('client_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (clientError) throw clientError;

      // Get profiles to match internal tickets
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email');
      
      // Get clients to match external tickets
      const { data: clients } = await supabase.from('profiles').select('user_id, full_name, email');

      const internalTickets = itData.map(t => {
        const profile = profiles?.find(p => p.user_id === t.user_id);
        return {
          ...t,
          source: 'internal',
          reporter_id: t.user_id,
          author_name: profile?.full_name || profile?.email || 'Unknown Employee'
        };
      });

      const externalTickets = clientData.map(t => {
        const client = clients?.find(c => c.user_id === t.client_id);
        return {
          ...t,
          source: 'client',
          reporter_id: t.client_id,
          category: 'other', // Add a default category for client tickets to satisfy types
          author_name: client?.full_name || client?.email || 'Unknown Client'
        };
      });

      return [...internalTickets, ...externalTickets];
    }
  });

  const updateTicketMutation = useMutation({
    mutationFn: async (payload: { 
      id: string, 
      status: "open" | "in_progress" | "resolved" | "closed", 
      priority: string,
      category?: string,
      notes: string, 
      source: 'internal' | 'client' 
    }) => {
      const table = payload.source === 'internal' ? 'it_tickets' : 'client_tickets';
      
      let updateData: any = {
        status: payload.status,
        priority: payload.priority,
        resolution_notes: payload.notes,
      };

      if (payload.source === 'internal' && payload.category) {
        updateData.category = payload.category;
        updateData.resolved_by = (payload.status === 'resolved' || payload.status === 'closed') ? user?.id : null;
      }
      
      const { error } = await supabase
        .from(table as any)
        .update(updateData)
        .eq('id', payload.id);
      
      if (error) throw error;

      // Send notification to the reporter
      const ticket = tickets.find(t => t.id === payload.id);
      if (ticket) {
        sendNotification({
          userId: ticket.reporter_id,
          title: 'Support Ticket Update',
          message: `Your ticket "${ticket.title}" status has been updated to ${payload.status.replace('_', ' ')}.`,
          type: payload.status === 'resolved' ? 'success' : 'info',
          actionLink: payload.source === 'internal' ? '/employee-portal' : '/client-portal'
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      toast.success('Ticket updated successfully');
      setSelectedTicket(null);
    },
    onError: (e) => toast.error('Failed to update ticket: ' + e.message)
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-80" />
          <p className="text-xs text-muted-foreground font-semibold tracking-wider uppercase">Loading Ticket Stream...</p>
        </div>
      </DashboardLayout>
    );
  }

  const openTicketsCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length;

  const handleOpenManage = (ticket: any) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setNewPriority(ticket.priority || 'medium');
    setNewCategory(ticket.category || 'other');
    setResolutionNote(ticket.resolution_notes || '');
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-16 px-4 sm:px-6">
        
        {/* Header Block */}
        <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card/80 to-muted/20 p-6 sm:p-8 shadow-xl backdrop-blur-md">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-3 text-slate-800 dark:text-slate-100">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                  <Monitor className="h-8 w-8" />
                </div>
                IT Helpdesk Admin
              </h1>
              <p className="text-sm font-medium text-muted-foreground max-w-xl leading-relaxed">
                Seamlessly manage, prioritize, and resolve support requests from both internal employee teams and external clients.
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-background/80 dark:bg-card/40 border border-border/60 rounded-2xl p-4 shadow-sm w-fit">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Support Node Online
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Internal Open */}
          <Card className="relative overflow-hidden border border-violet-500/10 bg-gradient-to-br from-card/90 to-violet-500/5 hover:to-violet-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/5 group hover:-translate-y-0.5 rounded-2xl">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-violet-500/5 blur-xl group-hover:bg-violet-500/10 transition-all duration-300" />
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Internal Open</p>
                <h3 className="text-2xl font-extrabold tracking-tight">{tickets.filter(t => t.source === 'internal' && t.status === 'open').length}</h3>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Client Open */}
          <Card className="relative overflow-hidden border border-emerald-500/10 bg-gradient-to-br from-card/90 to-emerald-500/5 hover:to-emerald-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5 group hover:-translate-y-0.5 rounded-2xl">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-emerald-500/5 blur-xl group-hover:bg-emerald-500/10 transition-all duration-300" />
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                <Globe className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Client Open</p>
                <h3 className="text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">{tickets.filter(t => t.source === 'client' && t.status === 'open').length}</h3>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Total Active */}
          <Card className="relative overflow-hidden border border-amber-500/10 bg-gradient-to-br from-card/90 to-amber-500/5 hover:to-amber-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/5 group hover:-translate-y-0.5 rounded-2xl">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-amber-500/5 blur-xl group-hover:bg-amber-500/10 transition-all duration-300" />
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300">
                <Activity className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Active</p>
                <h3 className="text-2xl font-extrabold tracking-tight text-amber-600 dark:text-amber-500">{tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length}</h3>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Urgent */}
          <Card className="relative overflow-hidden border border-rose-500/10 bg-gradient-to-br from-card/90 to-rose-500/5 hover:to-rose-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/5 group hover:-translate-y-0.5 rounded-2xl">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-rose-500/5 blur-xl group-hover:bg-rose-500/10 transition-all duration-300" />
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform duration-300">
                <AlertTriangle className="h-5 w-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Urgent</p>
                <h3 className="text-2xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">{urgentCount}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 p-1.5 bg-muted/60 dark:bg-card/40 border border-border/40 rounded-2xl max-w-lg mx-auto shadow-sm">
            <TabsTrigger 
              value="internal" 
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm data-[state=active]:shadow-sm data-[state=active]:bg-background"
            >
              <Users className="h-4 w-4" /> Internal (Employees)
            </TabsTrigger>
            <TabsTrigger 
              value="client" 
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm data-[state=active]:shadow-sm data-[state=active]:bg-background"
            >
              <Globe className="h-4 w-4" /> External (Clients)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="internal" className="outline-none space-y-4">
            {renderTicketQueue('internal')}
          </TabsContent>
          
          <TabsContent value="client" className="outline-none space-y-4">
            {renderTicketQueue('client')}
          </TabsContent>
        </Tabs>
      </div>

      {/* Interactive Manage Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={o => !o && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-3xl border border-border/40 shadow-2xl bg-card">
          <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Ticket className="h-5 w-5 text-primary" /> Manage Support Ticket
            </DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              
              {/* Ticket Details Panel */}
              <div className="bg-gradient-to-br from-muted/50 to-muted/25 border border-border/40 p-5 rounded-2xl space-y-3 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 p-4">
                  <Badge variant="outline" className="capitalize text-[10px] border-border bg-background shadow-xs font-bold text-slate-600 dark:text-slate-400">
                    {selectedTicket.source === 'internal' ? 'Employee' : 'Client'} ticket
                  </Badge>
                </div>
                
                <div className="space-y-1 pr-16">
                  <h4 className="font-extrabold text-slate-850 dark:text-slate-100 text-base leading-snug">{selectedTicket.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    Reported by: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedTicket.author_name}</span>
                  </p>
                </div>
                
                <Separator className="opacity-60" />
                
                <p className="text-sm text-slate-600 dark:text-slate-350 whitespace-pre-wrap leading-relaxed max-h-[140px] overflow-y-auto pr-1">
                  {selectedTicket.description}
                </p>
                
                <div className="pt-2 flex flex-wrap gap-4 text-[10px] text-muted-foreground font-semibold">
                  <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5 opacity-60" /> Category: <span className="capitalize text-slate-600 dark:text-slate-300">{selectedTicket.category || 'Other'}</span></span>
                  <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 opacity-60" /> Created: <span className="text-slate-600 dark:text-slate-300">{format(new Date(selectedTicket.created_at), 'PPP')}</span></span>
                </div>
              </div>

              {/* Action Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider block pl-0.5">Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="rounded-xl h-10 shadow-xs border-border/60 hover:bg-muted/50 transition-all font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="open" className="text-sm font-medium">Open</SelectItem>
                      <SelectItem value="in_progress" className="text-sm font-medium">In Progress</SelectItem>
                      <SelectItem value="resolved" className="text-sm font-medium">Resolved</SelectItem>
                      <SelectItem value="closed" className="text-sm font-medium">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider block pl-0.5">Priority</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="rounded-xl h-10 shadow-xs border-border/60 hover:bg-muted/50 transition-all font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="low" className="text-sm font-medium">Low</SelectItem>
                      <SelectItem value="medium" className="text-sm font-medium">Medium</SelectItem>
                      <SelectItem value="high" className="text-sm font-medium">High</SelectItem>
                      <SelectItem value="urgent" className="text-sm font-medium">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedTicket.source === 'internal' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider block pl-0.5">Category</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger className="rounded-xl h-10 shadow-xs border-border/60 hover:bg-muted/50 transition-all font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="software" className="text-sm font-medium">Software</SelectItem>
                        <SelectItem value="hardware" className="text-sm font-medium">Hardware</SelectItem>
                        <SelectItem value="network" className="text-sm font-medium">Network</SelectItem>
                        <SelectItem value="other" className="text-sm font-medium">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>

              {/* Resolution Notes Area */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider block pl-0.5">Resolution Notes (Visible to Reporter)</Label>
                <Textarea 
                  placeholder="Describe the solution or action taken (e.g. Cleared hardware queue, resolved port block)..."
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  className="min-h-[100px] rounded-2xl shadow-xs border-border/60 focus-visible:ring-primary p-3 text-sm leading-relaxed"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="p-6 pt-4 border-t border-border/50 bg-muted/10 flex flex-row items-center justify-end gap-2">
            <Button variant="outline" className="rounded-xl h-10 px-5 text-sm font-bold shadow-xs" onClick={() => setSelectedTicket(null)}>Cancel</Button>
            <Button 
              className="gradient-primary rounded-xl h-10 px-5 text-sm font-bold shadow-sm text-white hover:brightness-105 transition-all" 
              onClick={() => updateTicketMutation.mutate({ 
                id: selectedTicket.id, 
                status: newStatus as any, 
                priority: newPriority,
                category: newCategory,
                notes: resolutionNote,
                source: selectedTicket.source 
              })} 
              disabled={updateTicketMutation.isPending}
            >
              {updateTicketMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );

  function renderTicketQueue(source: 'internal' | 'client') {
    const queueTickets = tickets.filter(t => {
      const matchSource = t.source === source;
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      const matchCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchSource && matchStatus && matchPriority && matchCategory;
    });

    return (
      <Card className="border border-border/50 shadow-xl overflow-hidden rounded-3xl bg-card">
        {/* Card Header with Filters */}
        <CardHeader className="border-b border-border/50 bg-card/40 p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              {source === 'internal' ? 'Internal Support Queue' : 'External Client Queue'}
            </CardTitle>
            <CardDescription className="text-sm font-medium">
              {source === 'internal' ? 'Manage operational issues reported by company employees.' : 'Support ticket lifecycle for clients and project representatives.'}
            </CardDescription>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider pl-0.5">
              <Filter className="h-3.5 w-3.5" /> Filters
            </div>
            <div className="grid grid-cols-3 sm:flex gap-2">
              <div className="relative">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs rounded-xl font-semibold shadow-xs border-border/60 hover:bg-muted/50 transition-colors">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs">All Status</SelectItem>
                    <SelectItem value="open" className="text-xs">Open</SelectItem>
                    <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
                    <SelectItem value="resolved" className="text-xs">Resolved</SelectItem>
                    <SelectItem value="closed" className="text-xs">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs rounded-xl font-semibold shadow-xs border-border/60 hover:bg-muted/50 transition-colors">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs">All Priority</SelectItem>
                    <SelectItem value="low" className="text-xs">Low</SelectItem>
                    <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                    <SelectItem value="high" className="text-xs">High</SelectItem>
                    <SelectItem value="urgent" className="text-xs">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs rounded-xl font-semibold shadow-xs border-border/60 hover:bg-muted/50 transition-colors">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                    <SelectItem value="software" className="text-xs">Software</SelectItem>
                    <SelectItem value="hardware" className="text-xs">Hardware</SelectItem>
                    <SelectItem value="network" className="text-xs">Network</SelectItem>
                    <SelectItem value="other" className="text-xs">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {queueTickets.length === 0 ? (
            <div className="text-center py-16 px-4 text-muted-foreground border-0 rounded-none bg-muted/5 flex flex-col items-center justify-center">
              <div className="p-4 rounded-full bg-muted/60 mb-4 text-muted-foreground/30">
                <MessageSquare className="h-10 w-10 animate-bounce" />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">No Support Tickets Found</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                There are no active {source} tickets matching the chosen filters in the system database.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              
              {/* Mobile View: High-fidelity list of cards */}
              <div className="block md:hidden divide-y divide-border/40">
                {queueTickets.map(ticket => {
                  const pStyle = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium;
                  const sStyle = STATUS_STYLES[ticket.status] || STATUS_STYLES.open;
                  
                  const reporterName = ticket.author_name || 'U';
                  const initials = reporterName
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <div key={ticket.id} className="p-5 space-y-4 hover:bg-muted/5 transition-colors">
                      {/* Card Header: Badges and Date */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1.5 items-center">
                          <Badge variant="outline" className={`h-6 rounded-full px-2.5 text-[9px] uppercase tracking-wider font-bold ${pStyle.badge}`}>
                            {ticket.priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1 animate-pulse" />}
                            {ticket.priority || 'medium'}
                          </Badge>
                          <Badge variant="outline" className={`h-6 rounded-full px-2.5 text-[9px] capitalize tracking-wide font-bold ${sStyle.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sStyle.dot} mr-1.5`} />
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>

                      {/* Card Content: Title and Meta */}
                      <div className="space-y-1.5">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-snug">
                          {ticket.title}
                        </h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground/50" />
                          <span className="capitalize text-slate-500 font-semibold">{ticket.category || 'General Support'}</span>
                          <span className="text-muted-foreground/30">•</span>
                          <span className="text-slate-500 font-semibold">{ticket.source === 'internal' ? 'Employee Portal' : 'Client Channel'}</span>
                        </p>
                      </div>

                      {/* Card Footer: Profile Info & Manage Button */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-primary-foreground text-primary-foreground flex items-center justify-center text-xs font-bold shadow-sm">
                            {initials}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-none">
                              {ticket.author_name}
                            </p>
                            <p className="text-[9px] font-bold text-muted-foreground leading-none uppercase tracking-wide">
                              Reporter
                            </p>
                          </div>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 px-4 text-xs font-bold border rounded-xl border-border/80 text-primary hover:bg-primary hover:text-white transition-all shadow-xs flex items-center gap-1 bg-background"
                          onClick={() => handleOpenManage(ticket)}
                        >
                          Manage <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Sleek high-fidelity list table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="p-4 pl-6 font-bold">Ticket Details</th>
                      <th className="p-4 font-bold">Reporter</th>
                      <th className="p-4 font-bold">Priority</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 pr-6 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {queueTickets.map(ticket => {
                      const pStyle = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium;
                      const sStyle = STATUS_STYLES[ticket.status] || STATUS_STYLES.open;
                      
                      return (
                        <tr key={ticket.id} className="hover:bg-muted/5 transition-colors group">
                          <td className="p-4 pl-6 max-w-sm">
                            <div className="space-y-1">
                              <p className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors truncate">
                                {ticket.title}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 font-medium">
                                {source === 'internal' ? <Users className="h-3.5 w-3.5 text-muted-foreground/50" /> : <Globe className="h-3.5 w-3.5 text-muted-foreground/50" />}
                                <span className="font-semibold capitalize text-slate-500">{ticket.category || 'General Support'}</span>
                                <span className="text-muted-foreground/30">•</span>
                                <span className="text-slate-500 font-semibold">{format(new Date(ticket.created_at), 'MMM d, yyyy')}</span>
                              </p>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-snug">
                              {ticket.author_name}
                            </p>
                            <p className="text-[9px] text-muted-foreground capitalize font-bold uppercase tracking-wide">
                              {source === 'internal' ? 'Employee' : 'Client'} Account
                            </p>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className={`h-6 rounded-full px-2.5 text-[9px] uppercase tracking-wider font-bold ${pStyle.badge}`}>
                              {ticket.priority === 'urgent' && <AlertTriangle className="h-3.5 w-3.5 mr-1 animate-pulse" />}
                              {ticket.priority || 'medium'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className={`h-6 rounded-full px-2.5 text-[9px] capitalize tracking-wide font-bold ${sStyle.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${sStyle.dot} mr-1.5`} />
                              {ticket.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="font-bold border border-transparent rounded-xl hover:border-primary/20 hover:bg-primary/5 hover:text-primary transition-all duration-200 h-9 px-4 text-xs shadow-none"
                              onClick={() => handleOpenManage(ticket)}
                            >
                              Manage
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}
        </CardContent>
      </Card>
    );
  }
}
