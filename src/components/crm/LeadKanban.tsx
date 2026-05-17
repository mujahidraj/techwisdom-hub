/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { createPortal } from 'react-dom';
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
  useDroppable,
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
    opacity: isSortableDragging ? 0.4 : 1,
  };

  const navigate = useNavigate();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={() => navigate(`/crm/${lead.id}`)}
      className={`bg-white border border-slate-100 hover:border-orange-500/20 hover:shadow-md hover:shadow-slate-100/40 cursor-pointer transition-all rounded-2xl group overflow-hidden flex min-h-[110px] ${
        isDragging ? 'shadow-lg ring-2 ring-orange-500/35 border-orange-500/30' : ''
      }`}
    >
      {/* Left Grip Handle Strip: Highly grabable full-height DND trigger */}
      <div
        {...attributes}
        {...listeners}
        className="w-8 shrink-0 bg-slate-50/80 group-hover:bg-orange-50/40 border-r border-slate-100/80 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing text-slate-350 hover:text-slate-550 transition-colors"
        onClick={(e) => {
          e.stopPropagation(); // Prevent card navigation click when grabbing
        }}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Right Content Area */}
      <div className="flex-1 p-3.5 space-y-2 min-w-0">
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-[9px] font-black tracking-widest text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
            #{(lead as any).sl_no || lead.id.slice(0, 4)}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-all"
                onClick={(e) => {
                  e.stopPropagation(); // Stop card navigation click
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(lead); }} className="rounded-lg text-slate-700">
                <Edit className="h-4 w-4 mr-2 text-slate-400" />
                Edit Lead
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-lg text-slate-700">
                  <ChevronRight className="h-4 w-4 mr-2 text-slate-400" />
                  Move Column
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="rounded-xl border-slate-100">
                  {columns
                    .filter((c) => c.id !== lead.status)
                    .map((col) => (
                      <DropdownMenuItem
                        key={col.id}
                        onClick={(e) => { e.stopPropagation(); onStatusChange(lead, col.id); }}
                        className="rounded-lg"
                      >
                        <div className={`w-2 h-2 rounded-full ${col.color} mr-2`} />
                        <span className="capitalize">{col.title.replace('_', ' ')}</span>
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator className="border-slate-50" />
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(lead); }}
                className="rounded-lg text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Company Name on Absolute Focus */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Building2 className="h-4 w-4 text-orange-500 shrink-0" />
            <h4 className="font-extrabold text-sm text-slate-805 tracking-tight truncate leading-snug group-hover:text-orange-600 transition-colors">
              {lead.business_name}
            </h4>
          </div>
          {lead.contact_person && (
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide pl-5 truncate">
              {lead.contact_person}
            </p>
          )}
        </div>

        {/* Info badges */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100/60">
          <div className="flex items-center gap-2 text-xs text-slate-550 min-w-0">
            {lead.phone && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 truncate">
                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                {lead.phone}
              </span>
            )}
          </div>
          {lead.category && (
            <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 border border-slate-100 text-slate-500 rounded-md px-1.5 py-0.5 shrink-0">
              {lead.category.replace('_', ' ')}
            </Badge>
          )}
        </div>

      </div>
    </Card>
  );
}

function DragOverlayCard({ lead }: { lead: Lead }) {
  return (
    <Card className="bg-white border border-orange-500/30 shadow-2xl ring-2 ring-orange-500/20 cursor-grabbing opacity-90 rotate-2 scale-105 flex min-h-[110px] w-[280px]">
      <div className="w-8 shrink-0 bg-orange-50/40 border-r border-slate-100 flex flex-col items-center justify-center text-orange-500">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 p-3.5 space-y-2 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black tracking-widest text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
            #{(lead as any).sl_no || lead.id.slice(0, 4)}
          </span>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Building2 className="h-4 w-4 text-orange-500 shrink-0 animate-pulse" />
            <h4 className="font-extrabold text-sm text-slate-805 tracking-tight truncate leading-snug">
              {lead.business_name}
            </h4>
          </div>
          {lead.contact_person && (
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide pl-5 truncate">
              {lead.contact_person}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

interface KanbanColumnProps {
  column: typeof columns[0];
  allColumnLeads: Lead[];
  visibleLeads: Lead[];
  hasMore: boolean;
  limit: number;
  showMore: (columnId: string) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onStatusChange: (lead: Lead, status: LeadStatus) => void;
}

function KanbanColumn({
  column,
  allColumnLeads,
  visibleLeads,
  hasMore,
  limit,
  showMore,
  onEdit,
  onDelete,
  onStatusChange,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div className="space-y-3 w-full lg:flex-1 lg:min-w-0">
      <div className="flex items-center gap-2 px-2">
        <div className={`w-2 h-2 rounded-full ${column.color}`} />
        <h3 className="font-semibold text-sm text-slate-700 capitalize">
          {column.title.replace('_', ' ')}
        </h3>
        <Badge variant="secondary" className="ml-auto font-black bg-slate-100 text-slate-500 text-[10px]">
          {allColumnLeads.length}
        </Badge>
      </div>
      <SortableContext
        items={visibleLeads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
        id={column.id}
      >
        <div
          ref={setNodeRef}
          className="space-y-3 min-h-[300px] p-2 bg-slate-50/50 rounded-2xl border border-slate-100/60 shadow-inner"
          data-column-id={column.id}
        >
          {visibleLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
          
          {hasMore && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white rounded-xl py-2 h-auto"
              onClick={() => showMore(column.id)}
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              Show More ({allColumnLeads.length - limit} remaining)
            </Button>
          )}

          {allColumnLeads.length === 0 && (
            <div className="h-32 flex items-center justify-center text-xs text-slate-405 border border-dashed border-slate-200 rounded-2xl bg-white/40 font-bold uppercase tracking-wider">
              Drop items here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
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
        <div className="flex flex-col lg:flex-row gap-4.5 items-start h-full w-full">
          {columns.map((column) => {
            const allColumnLeads = getLeadsByStatus(column.id);
            const limit = columnLimits[column.id] || INITIAL_LIMIT;
            const visibleLeads = allColumnLeads.slice(0, limit);
            const hasMore = allColumnLeads.length > limit;

            return (
              <KanbanColumn
                key={column.id}
                column={column}
                allColumnLeads={allColumnLeads}
                visibleLeads={visibleLeads}
                hasMore={hasMore}
                limit={limit}
                showMore={showMore}
                onEdit={setEditLead}
                onDelete={setDeleteLead}
                onStatusChange={handleStatusChange}
              />
            );
          })}
        </div>

        {createPortal(
          <DragOverlay>
            {activeLead ? <DragOverlayCard lead={activeLead} /> : null}
          </DragOverlay>,
          document.body
        )}
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