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

export default function HelpdeskAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [newStatus, setNewStatus] = useState('open');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch all tickets with user profiles
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: async () => {
      // Get tickets
      const { data, error } = await supabase
        .from('it_tickets')
        .select(`
          *,
          user:user_id ( id )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Get profiles to match
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email');
      
      // Combine them
      return data.map(t => {
        const profile = profiles?.find(p => p.user_id === t.user_id);
        return {
          ...t,
          author_name: profile?.full_name || profile?.email || 'Unknown User'
        };
      });
    }
  });

  const updateTicketMutation = useMutation({
    mutationFn: async (payload: { id: string, status: "open" | "in_progress" | "resolved" | "closed", notes: string }) => {
      const { error } = await supabase
        .from('it_tickets')
        .update({
          status: payload.status,
          resolution_notes: payload.notes,
          resolved_by: payload.status === 'resolved' || payload.status === 'closed' ? user?.id : null
        })
        .eq('id', payload.id);
      if (error) throw error;
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
    setResolutionNote(ticket.resolution_notes || '');
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Monitor className="h-8 w-8 text-primary" /> IT Helpdesk Admin</h1>
          <p className="text-muted-foreground mt-1">Manage, assign, and resolve internal employee support tickets.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Open Tickets</p>
              <h3 className="text-2xl font-bold mt-1">{openTicketsCount}</h3>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">In Progress</p>
              <h3 className="text-2xl font-bold mt-1 text-primary">{inProgressCount}</h3>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Urgent Actions Needed</p>
              <h3 className="text-2xl font-bold mt-1 text-destructive">{urgentCount}</h3>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Support Queue</CardTitle>
              <CardDescription>All incoming requests from the team</CardDescription>
            </div>
            <div className="flex gap-2 items-center w-64">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tickets</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No tickets found matching this filter.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="grid grid-cols-12 p-4 text-sm font-medium text-muted-foreground border-b bg-muted/50">
                  <div className="col-span-4">Ticket</div>
                  <div className="col-span-3">Reporter</div>
                  <div className="col-span-2">Priority</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>
                <div className="divide-y">
                  {filteredTickets.map(ticket => (
                    <div key={ticket.id} className="grid grid-cols-12 p-4 items-center hover:bg-muted/30 transition-colors">
                      <div className="col-span-4 pr-4">
                        <p className="font-medium text-sm truncate">{ticket.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{ticket.category} • {format(new Date(ticket.created_at), 'MMM d, yyyy')}</p>
                      </div>
                      <div className="col-span-3">
                        <p className="text-sm truncate">{ticket.author_name}</p>
                      </div>
                      <div className="col-span-2">
                        {ticket.priority === 'urgent' && <Badge variant="destructive" className="h-5 px-1.5"><AlertTriangle className="h-3 w-3 mr-1"/> Urgent</Badge>}
                        {ticket.priority === 'high' && <Badge variant="destructive" className="h-5 px-1.5">High</Badge>}
                        {ticket.priority === 'medium' && <Badge variant="secondary" className="h-5 px-1.5">Medium</Badge>}
                        {ticket.priority === 'low' && <Badge variant="outline" className="h-5 px-1.5">Low</Badge>}
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline" className={`capitalize ${ticket.status === 'resolved' ? 'border-success text-success' : ''}`}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenManage(ticket)}>Manage</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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

              <div>
                <Label className="mb-1 block">Update Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open (Unassigned)</SelectItem>
                    <SelectItem value="in_progress">In Progress (Working on it)</SelectItem>
                    <SelectItem value="resolved">Resolved (Fix applied)</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block">Resolution Notes (Visible to Employee)</Label>
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
            <Button className="gradient-primary" onClick={() => updateTicketMutation.mutate({ id: selectedTicket.id, status: newStatus as any, notes: resolutionNote })} disabled={updateTicketMutation.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
