import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Building2, MoreVertical, Edit, Trash2, ChevronRight, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { EditLeadDialog } from './EditLeadDialog';
import { DealWonDialog } from './DealWonDialog';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

const columns: { id: LeadStatus; title: string; color: string }[] = [
  { id: 'new', title: 'New', color: 'bg-blue-500' },
  { id: 'contacted', title: 'Contacted', color: 'bg-yellow-500' },
  { id: 'in_negotiation', title: 'In Negotiation', color: 'bg-purple-500' },
  { id: 'deal_won', title: 'Deal Won', color: 'bg-green-500' },
  { id: 'deal_lost', title: 'Deal Lost', color: 'bg-red-500' },
];

interface LeadCardProps {
  lead: Lead;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onStatusChange: (lead: Lead, status: LeadStatus) => void;
  isDragging?: boolean;
}

function LeadCard({ lead, onEdit, onDelete, onStatusChange, isDragging }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`glass-card cursor-grab hover:shadow-medium transition-shadow group ${
        isDragging ? 'shadow-lg ring-2 ring-primary' : ''
      }`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div {...attributes} {...listeners} className="cursor-grab">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm truncate">{lead.business_name}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(lead)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ChevronRight className="h-4 w-4 mr-2" />
                  Move to
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {columns
                    .filter((c) => c.id !== lead.status)
                    .map((col) => (
                      <DropdownMenuItem
                        key={col.id}
                        onClick={() => onStatusChange(lead, col.id)}
                      >
                        <div className={`w-2 h-2 rounded-full ${col.color} mr-2`} />
                        {col.title}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(lead)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {lead.contact_person && (
          <p className="text-xs text-muted-foreground">{lead.contact_person}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {lead.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {lead.phone}
            </span>
          )}
        </div>
        {lead.category && (
          <Badge variant="outline" className="text-[10px] capitalize">
            {lead.category.replace('_', ' ')}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function DragOverlayCard({ lead }: { lead: Lead }) {
  return (
    <Card className="glass-card shadow-lg ring-2 ring-primary cursor-grabbing">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm truncate">{lead.business_name}</span>
        </div>
        {lead.contact_person && (
          <p className="text-xs text-muted-foreground">{lead.contact_person}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function LeadKanban() {
  const queryClient = useQueryClient();
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [dealWonLead, setDealWonLead] = useState<Lead | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
      toast.success(`Lead moved to ${newStatus.replace('_', ' ')}`);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find((l) => l.id === event.active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;

    if (!over) return;

    const leadId = active.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Check if dropped over a column
    const targetColumn = columns.find((c) => c.id === over.id);
    if (targetColumn && targetColumn.id !== lead.status) {
      handleStatusChange(lead, targetColumn.id);
      return;
    }

    // Check if dropped over another lead
    const overLead = leads.find((l) => l.id === over.id);
    if (overLead && overLead.status !== lead.status) {
      handleStatusChange(lead, overLead.status);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeLead = leads.find((l) => l.id === active.id);
    if (!activeLead) return;

    // Check if over a column directly
    const targetColumn = columns.find((c) => c.id === over.id);
    if (targetColumn) return;

    // Check if over another lead in a different column
    const overLead = leads.find((l) => l.id === over.id);
    if (overLead && overLead.status !== activeLead.status) {
      // Optimistically update the lead's status for smooth UX
    }
  };

  const getLeadsByStatus = (status: LeadStatus) =>
    leads.filter((lead) => lead.status === status);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading leads...</div>;
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto">
          {columns.map((column) => {
            const columnLeads = getLeadsByStatus(column.id);
            return (
              <div key={column.id} className="space-y-3 min-w-[250px]">
                <div className="flex items-center gap-2 px-2">
                  <div className={`w-2 h-2 rounded-full ${column.color}`} />
                  <h3 className="font-semibold">{column.title}</h3>
                  <Badge variant="secondary" className="ml-auto">
                    {columnLeads.length}
                  </Badge>
                </div>
                <SortableContext
                  items={columnLeads.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                  id={column.id}
                >
                  <div
                    className="space-y-2 min-h-[300px] p-2 bg-muted/30 rounded-lg"
                    data-column-id={column.id}
                  >
                    {columnLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onEdit={setEditLead}
                        onDelete={setDeleteLead}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                    {columnLeads.length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                        Drop leads here
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeLead ? <DragOverlayCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>

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
