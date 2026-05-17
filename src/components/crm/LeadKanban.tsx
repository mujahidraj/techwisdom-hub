/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Building2, MoreVertical, Edit, Trash2, ChevronRight, GripVertical, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useActivityLog } from '@/hooks/useActivityLog';
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
import { useNavigate } from 'react-router';

type Lead = Tables<'leads'>;
type LeadStatus = Lead['status'];

const columns: { id: LeadStatus; title: string; color: string }[] = [
  { id: 'new', title: 'New', color: 'bg-blue-500' },
  { id: 'contacted', title: 'Contacted', color: 'bg-yellow-500' },
  { id: 'in_negotiation', title: 'In Negotiation', color: 'bg-purple-500' },
  { id: 'deal_won', title: 'Deal Won', color: 'bg-green-500' },
  { id: 'deal_lost', title: 'Deal Lost', color: 'bg-red-500' },
];

// ... (LeadCard and DragOverlayCard components remain exactly the same as previous step) ...
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

  const navigate = useNavigate();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={() => navigate(`/crm/${lead.id}`)}
      className={`glass-card cursor-grab hover:shadow-medium transition-shadow group ${
        isDragging ? 'shadow-lg ring-2 ring-primary' : ''
      }`}
    >
      <CardContent  className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()}>
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                #{(lead as any).sl_no || lead.id.slice(0,4)}
            </span>

            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm truncate">{lead.business_name}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(lead); }}>
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
                        onClick={(e) => { e.stopPropagation(); onStatusChange(lead, col.id); }}
                      >
                        <div className={`w-2 h-2 rounded-full ${col.color} mr-2`} />
                        {col.title}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(lead); }}
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
    <Card className="glass-card shadow-lg ring-2 ring-primary cursor-grabbing opacity-90 rotate-2 scale-105">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
             #{(lead as any).sl_no || lead.id.slice(0,4)}
          </span>
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

// --- UPDATED SIGNATURE TO ACCEPT NEW FILTERS ---
export function LeadKanban({ 
    searchQuery = '', 
    filter = 'all',
    cityFilter = '',
    categoryFilter = 'all'
}: { 
    searchQuery?: string, 
    filter?: string,
    cityFilter?: string,
    categoryFilter?: string
}) {
  const queryClient = useQueryClient();
  const { logActivity, logSecurity } = useActivityLog();
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [dealWonLead, setDealWonLead] = useState<Lead | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  
  const [columnLimits, setColumnLimits] = useState<Record<string, number>>({});
  const INITIAL_LIMIT = 10;

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

  // --- FILTERING LOGIC ---
  const filteredLeads = leads.filter(lead => {
    // 1. Search Filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
            lead.business_name?.toLowerCase().includes(query) ||
            lead.contact_person?.toLowerCase().includes(query) ||
            lead.email?.toLowerCase().includes(query) ||
            lead.phone?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
    }

    // 2. Badge Filter
    if (filter === 'high_value') {
        return ((lead as any).value || 0) >= 5000;
    } else if (filter === 'new_week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return new Date(lead.created_at) >= oneWeekAgo;
    } else if (filter === 'follow_up') {
        return lead.status === 'contacted';
    }

    // 3. City Filter
    if (cityFilter && lead.city) {
        if (!lead.city.toLowerCase().includes(cityFilter.toLowerCase())) return false;
    }

    // 4. Category Filter
    if (categoryFilter && categoryFilter !== 'all') {
        if (lead.category !== categoryFilter) return false;
    }

    return true; 
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase.from('leads').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      const leadItem = leads.find((l) => l.id === variables.id);
      if (leadItem) {
        logActivity('updated', 'lead', `Moved lead "${leadItem.business_name}" status to "${variables.status}"`, variables.id);
        logSecurity('UPDATE', 'CRM_LEAD', `Moved lead "${leadItem.business_name}" status from "${leadItem.status}" to "${variables.status}"`, variables.id);
      }
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const leadItem = leads.find((l) => l.id === id);
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
      if (leadItem) {
        logActivity('deleted', 'lead', leadItem.business_name, id);
        logSecurity('DELETE', 'CRM_LEAD', `Deleted CRM lead "${leadItem.business_name}"`, id);
      }
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

    const targetColumn = columns.find((c) => c.id === over.id);
    if (targetColumn && targetColumn.id !== lead.status) {
      handleStatusChange(lead, targetColumn.id);
      return;
    }

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

    const targetColumn = columns.find((c) => c.id === over.id);
    if (targetColumn) return;

    const overLead = leads.find((l) => l.id === over.id);
    if (overLead && overLead.status !== activeLead.status) {
      // Optimistically update logic preserved
    }
  };

  const getLeadsByStatus = (status: LeadStatus) =>
    filteredLeads.filter((lead) => lead.status === status);

  const showMore = (columnId: string) => {
    setColumnLimits(prev => ({
        ...prev,
        [columnId]: (prev[columnId] || INITIAL_LIMIT) + 50
    }));
  };

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
        <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-6 items-start h-full">
          {columns.map((column) => {
            const allColumnLeads = getLeadsByStatus(column.id);
            const limit = columnLimits[column.id] || INITIAL_LIMIT;
            const visibleLeads = allColumnLeads.slice(0, limit);
            const hasMore = allColumnLeads.length > limit;

            return (
              <div 
                key={column.id} 
                className="space-y-3 w-full lg:w-[300px] flex-shrink-0"
              >
                <div className="flex items-center gap-2 px-2">
                  <div className={`w-2 h-2 rounded-full ${column.color}`} />
                  <h3 className="font-semibold">{column.title}</h3>
                  <Badge variant="secondary" className="ml-auto">
                    {allColumnLeads.length}
                  </Badge>
                </div>
                <SortableContext
                  items={visibleLeads.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                  id={column.id}
                >
                  <div
                    className="space-y-3 min-h-[150px] p-2 bg-muted/30 rounded-lg border border-border/50"
                    data-column-id={column.id}
                  >
                    {visibleLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onEdit={setEditLead}
                        onDelete={setDeleteLead}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                    
                    {hasMore && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs text-muted-foreground hover:bg-white"
                            onClick={() => showMore(column.id)}
                        >
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Show More ({allColumnLeads.length - limit} remaining)
                        </Button>
                    )}

                    {allColumnLeads.length === 0 && (
                      <div className="h-32 flex items-center justify-center text-sm text-muted-foreground border-2 border-dashed rounded-lg bg-background/50">
                        Drop items here
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

      <EditLeadDialog lead={editLead} onOpenChange={(open) => !open && setEditLead(null)} />

      <DealWonDialog
        lead={dealWonLead}
        onOpenChange={(open) => !open && setDealWonLead(null)}
        onSuccess={() => {
          updateStatusMutation.mutate({ id: dealWonLead!.id, status: 'deal_won' });
          setDealWonLead(null);
        }}
      />

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