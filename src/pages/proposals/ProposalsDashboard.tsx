import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, FileText, Download, Send, CheckCircle, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function ProposalsDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [selectedProposal, setSelectedProposal] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select(`
          *,
          leads (business_name, contact_person, email),
          proposal_items (*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-for-proposals'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('id, business_name, contact_person');
      return data || [];
    }
  });

  const saveProposal = useMutation({
    mutationFn: async (payload: any) => {
      const { id, title, lead_id, status, content, terms_and_conditions } = payload;
      
      let totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

      const propData = { title, lead_id, status, content, terms_and_conditions, total_amount: totalAmount, created_by: user?.id };
      
      let propId = id;
      if (id) {
        const { error } = await supabase.from('proposals').update(propData).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('proposals').insert(propData).select().single();
        if (error) throw error;
        propId = data.id;
      }

      // Sync items
      if (propId) {
        // Delete old items
        await supabase.from('proposal_items').delete().eq('proposal_id', propId);
        // Insert new items
        if (items.length > 0) {
          const itemsData = items.map(i => ({
            proposal_id: propId,
            title: i.title,
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.quantity * i.unit_price
          }));
          await supabase.from('proposal_items').insert(itemsData);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposal saved successfully');
      setView('list');
    },
    onError: (e: any) => toast.error(e.message)
  });

  const deleteProposal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('proposals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposal deleted');
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: "draft" | "sent" | "viewed" | "accepted" | "rejected" }) => {
      const { error } = await supabase.from('proposals').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] })
  });

  const openBuilder = (proposal?: any) => {
    if (proposal) {
      setSelectedProposal(proposal);
      setItems(proposal.proposal_items || []);
    } else {
      setSelectedProposal({ title: 'New Project Proposal', status: 'draft', content: '## Executive Summary\n\n## Scope of Work\n\n' });
      setItems([]);
    }
    setView('builder');
  };

  const addItem = () => setItems([...items, { title: '', description: '', quantity: 1, unit_price: 0 }]);
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  if (isLoading) return <DashboardLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;

  if (view === 'builder') {
    const total = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">{selectedProposal.id ? 'Edit Proposal' : 'New Proposal'}</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setView('list')}>Cancel</Button>
              <Button className="gradient-primary" onClick={() => saveProposal.mutate(selectedProposal)} disabled={saveProposal.isPending}>
                {saveProposal.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />} Save Proposal
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle>Document Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Proposal Title</Label>
                    <Input value={selectedProposal.title} onChange={e => setSelectedProposal({ ...selectedProposal, title: e.target.value })} />
                  </div>
                  <div>
                    <Label>Select Lead/Client</Label>
                    <Select value={selectedProposal.lead_id || ''} onValueChange={v => setSelectedProposal({ ...selectedProposal, lead_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose a lead" /></SelectTrigger>
                      <SelectContent>
                        {leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.business_name} ({l.contact_person || 'N/A'})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Proposal Content (Markdown)</Label>
                    <Textarea rows={12} value={selectedProposal.content} onChange={e => setSelectedProposal({ ...selectedProposal, content: e.target.value })} className="font-mono text-sm" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle>Pricing / Line Items</CardTitle>
                  <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-3 items-start border p-3 rounded-md bg-muted/20 relative group">
                      <div className="flex-1 space-y-2">
                        <Input placeholder="Item Title" value={item.title} onChange={e => updateItem(index, 'title', e.target.value)} />
                        <Input placeholder="Description (optional)" value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} className="text-sm" />
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} />
                      </div>
                      <div className="w-32">
                        <Label className="text-xs">Unit Price</Label>
                        <Input type="number" value={item.unit_price} onChange={e => updateItem(index, 'unit_price', Number(e.target.value))} />
                      </div>
                      <div className="w-24 pt-6 text-right font-semibold">
                        ${(item.quantity * item.unit_price).toLocaleString()}
                      </div>
                      <Button variant="ghost" size="icon" className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(index)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No line items added yet.</p>}
                  
                  <div className="border-t pt-4 flex justify-between items-center text-xl font-bold">
                    <span>Total Investment</span>
                    <span className="text-primary">${total.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                <CardContent>
                  <Select value={selectedProposal.status} onValueChange={v => setSelectedProposal({ ...selectedProposal, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="viewed">Viewed</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Terms & Conditions</CardTitle></CardHeader>
                <CardContent>
                  <Textarea rows={6} value={selectedProposal.terms_and_conditions || ''} onChange={e => setSelectedProposal({ ...selectedProposal, terms_and_conditions: e.target.value })} placeholder="Payment terms, valid until, etc..." />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><FileText className="h-8 w-8 text-primary" /> Proposals & Quotes</h1>
            <p className="text-muted-foreground">Manage and track sent proposals</p>
          </div>
          <Button className="gradient-primary" onClick={() => openBuilder()}><Plus className="h-4 w-4 mr-2" />New Proposal</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {proposals.map((p: any) => (
            <Card key={p.id} className="relative group hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <Badge variant={p.status === 'accepted' ? 'default' : p.status === 'rejected' ? 'destructive' : p.status === 'sent' ? 'secondary' : 'outline'} className="capitalize">
                    {p.status}
                  </Badge>
                  <span className="font-bold text-lg text-primary">${p.total_amount?.toLocaleString() || 0}</span>
                </div>
                <h3 className="font-bold text-lg leading-tight mb-1">{p.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">Lead: {p.leads?.business_name || 'Unknown'}</p>
                
                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => openBuilder(p)}>
                    <Edit className="h-4 w-4 mr-2" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 text-blue-500 hover:text-blue-600">
                    <Send className="h-4 w-4 mr-2" /> Send
                  </Button>
                </div>
                
                {/* Delete Button */}
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => { if(confirm('Are you sure?')) deleteProposal.mutate(p.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {proposals.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground bg-card rounded-lg border border-dashed">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No proposals created yet. Click "New Proposal" to start.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
