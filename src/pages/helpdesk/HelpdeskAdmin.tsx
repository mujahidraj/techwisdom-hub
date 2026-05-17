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
import { Loader2, Monitor, AlertTriangle, Search, Filter, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Globe } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

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
    return <DashboardLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;
  }

  const openTicketsCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length;

  const filteredTickets = tickets.filter(t => statusFilter === 'all' ? true : t.status === statusFilter);

  const handleOpenManage = (ticket: any) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setNewPriority(ticket.priority || 'medium');
    setNewCategory(ticket.category || 'other');
    setResolutionNote(ticket.resolution_notes || '');
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Monitor className="h-8 w-8 text-primary" /> IT Helpdesk Admin</h1>
          <p className="text-muted-foreground mt-1">Manage, assign, and resolve internal employee support tickets.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Internal Open</p>
              <h3 className="text-2xl font-bold mt-1">{tickets.filter(t => t.source === 'internal' && t.status === 'open').length}</h3>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Client Open</p>
              <h3 className="text-2xl font-bold mt-1 text-primary">{tickets.filter(t => t.source === 'client' && t.status === 'open').length}</h3>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Active</p>
              <h3 className="text-2xl font-bold mt-1 text-orange-600">{tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length}</h3>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Urgent</p>
              <h3 className="text-2xl font-bold mt-1 text-destructive">{urgentCount}</h3>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="internal" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Internal (Employee)
            </TabsTrigger>
            <TabsTrigger value="client" className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> External (Client)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="internal" className="space-y-4">
            {renderTicketQueue('internal')}
          </TabsContent>
          <TabsContent value="client" className="space-y-4">
            {renderTicketQueue('client')}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedTicket} onOpenChange={o => !o && setSelectedTicket(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Ticket</DialogTitle></DialogHeader>
          {selectedTicket && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-semibold">{selectedTicket.title}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                <div className="pt-2 text-xs text-muted-foreground flex justify-between">
                  <span>Reported by: {selectedTicket.author_name}</span>
                  <span className="capitalize">Category: {selectedTicket.category}</span>
                </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Priority</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedTicket.source === 'internal' && (
                  <div>
                    <Label className="mb-1 block">Category</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="software">Software</SelectItem>
                        <SelectItem value="hardware">Hardware</SelectItem>
                        <SelectItem value="network">Network</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-1 block">Resolution Notes (Visible to Reporter)</Label>
                <Textarea 
                  placeholder="e.g. Granted access to Figma via admin console."
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTicket(null)}>Cancel</Button>
            <Button 
              className="gradient-primary" 
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
      <Card className="glass-card">
        <CardHeader className="flex flex-col md:flex-row items-center justify-between">
          <div>
            <CardTitle>{source === 'internal' ? 'Internal Employee Tickets' : 'External Client Tickets'}</CardTitle>
            <CardDescription>
              {source === 'internal' ? 'Manage requests from your team' : 'Support requests from your clients'}
            </CardDescription>
          </div>
           <div className="flex gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {queueTickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No {source} tickets found matching this filter.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="flex flex-col md:grid md:grid-cols-12 p-4 text-sm font-bold text-muted-foreground border-b bg-muted/30">
                <div className="col-span-4">Ticket</div>
                <div className="col-span-3">Reporter</div>
                <div className="col-span-2">Priority</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Action</div>
              </div>
              <div className="divide-y">
                {queueTickets.map(ticket => (
                  <div key={ticket.id} className="flex flex-col md:grid md:grid-cols-12 p-4 items-center hover:bg-muted/30 transition-colors group">
                    <div className="col-span-4 pr-4">
                      <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{ticket.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        {source === 'internal' ? <Users className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        {ticket.category || 'General Support'} • {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm font-medium">{ticket.author_name}</p>
                    </div>
                    <div className="col-span-2">
                      <div className="flex">
                        {ticket.priority === 'urgent' && <Badge className="bg-red-600 hover:bg-red-700 h-5 px-1.5"><AlertTriangle className="h-3 w-3 mr-1 animate-pulse"/> Urgent</Badge>}
                        {ticket.priority === 'high' && <Badge className="bg-orange-500 hover:bg-orange-600 h-5 px-1.5">High</Badge>}
                        {ticket.priority === 'medium' && <Badge variant="secondary" className="h-5 px-1.5 text-blue-700 bg-blue-50">Medium</Badge>}
                        {ticket.priority === 'low' && <Badge variant="outline" className="h-5 px-1.5 border-slate-300">Low</Badge>}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline" className={`capitalize font-bold ${ticket.status === 'resolved' ? 'border-success text-success bg-success/5' : ticket.status === 'open' ? 'border-primary text-primary bg-primary/5' : ''}`}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="col-span-1 text-right">
                      <Button variant="ghost" size="sm" className="font-bold hover:bg-primary hover:text-white" onClick={() => handleOpenManage(ticket)}>Manage</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
}
