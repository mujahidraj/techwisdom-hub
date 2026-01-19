import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, MoreHorizontal, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { EditLeadDialog } from './EditLeadDialog';
import { DealWonDialog } from './DealWonDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;
type LeadStatus = Lead['status'];

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-yellow-500',
  in_negotiation: 'bg-purple-500',
  deal_won: 'bg-green-500',
  deal_lost: 'bg-red-500',
};

const allStatuses: LeadStatus[] = ['new', 'contacted', 'in_negotiation', 'deal_won', 'deal_lost'];

export function LeadTable() {
  const queryClient = useQueryClient();
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [dealWonLead, setDealWonLead] = useState<Lead | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase.from('leads').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted successfully');
      setDeleteLead(null);
    },
    onError: (error) => {
      toast.error('Failed to delete lead: ' + error.message);
    },
  });

  const handleStatusChange = (lead: Lead, newStatus: LeadStatus) => {
    if (newStatus === 'deal_won' && lead.status !== 'deal_won') {
      setDealWonLead(lead);
    } else {
      updateStatusMutation.mutate({ id: lead.id, status: newStatus });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">{lead.business_name}</TableCell>
                <TableCell>{lead.contact_person || '-'}</TableCell>
                <TableCell>{lead.phone || '-'}</TableCell>
                <TableCell className="max-w-[150px] truncate">{lead.email || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {lead.category?.replace('_', ' ') || '-'}
                  </Badge>
                </TableCell>
                <TableCell>{lead.city || '-'}</TableCell>
                <TableCell>
                  <Badge className={`capitalize ${statusColors[lead.status]} text-white`}>
                    {lead.status?.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditLead(lead)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <ChevronRight className="h-4 w-4 mr-2" />
                          Change Status
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {allStatuses
                            .filter((s) => s !== lead.status)
                            .map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onClick={() => handleStatusChange(lead, status)}
                              >
                                <div className={`w-2 h-2 rounded-full ${statusColors[status]} mr-2`} />
                                <span className="capitalize">{status.replace('_', ' ')}</span>
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteLead(lead)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No leads yet. Import or add leads to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <EditLeadDialog lead={editLead} onOpenChange={(open) => !open && setEditLead(null)} />

      {/* Deal Won Dialog */}
      <DealWonDialog
        lead={dealWonLead}
        onOpenChange={(open) => !open && setDealWonLead(null)}
        onSuccess={() => {
          updateStatusMutation.mutate({ id: dealWonLead!.id, status: 'deal_won' });
          setDealWonLead(null);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLead} onOpenChange={(open) => !open && setDeleteLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteLead?.business_name}"? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLead && deleteMutation.mutate(deleteLead.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
