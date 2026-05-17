/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  DndContext, closestCenter, DragEndEvent, useSensor, useSensors, PointerSensor
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, GripVertical, Loader2, Trash2, BarChart3, TrendingUp,
  Users, DollarSign, FolderKanban, CheckSquare, Target, Gauge, Percent,
  Hash, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';

// Widget type definitions
const WIDGET_TYPES = [
  { value: 'total_leads', label: 'Total Leads', icon: Users, category: 'CRM', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  { value: 'won_deals', label: 'Won Deals', icon: TrendingUp, category: 'CRM', color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { value: 'conversion_rate', label: 'Conversion Rate', icon: Percent, category: 'CRM', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  { value: 'active_projects', label: 'Active Projects', icon: FolderKanban, category: 'Projects', color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  { value: 'completed_projects', label: 'Completed Projects', icon: CheckSquare, category: 'Projects', color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
  { value: 'total_revenue', label: 'Total Revenue', icon: DollarSign, category: 'Finance', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { value: 'total_expenses', label: 'Total Expenses', icon: DollarSign, category: 'Finance', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  { value: 'net_profit', label: 'Net Profit', icon: TrendingUp, category: 'Finance', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  { value: 'pending_invoices', label: 'Pending Invoices', icon: Hash, category: 'Finance', color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  { value: 'total_employees', label: 'Total Employees', icon: Users, category: 'HR', color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  { value: 'pending_leave', label: 'Pending Leave Requests', icon: Target, category: 'HR', color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  { value: 'open_tickets', label: 'Open IT Tickets', icon: Target, category: 'Operations', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
  { value: 'overdue_tasks', label: 'Overdue Tasks', icon: CheckSquare, category: 'Tasks', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  { value: 'revenue_goal_pct', label: 'Revenue Goal %', icon: Gauge, category: 'Finance', color: 'text-primary', bg: 'bg-primary/10' },
];

// --- Sortable Widget Card ---
function SortableWidget({ widget, value, onDelete }: { widget: any; value: any; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const typeDef = WIDGET_TYPES.find(t => t.value === widget.widget_type);
  const Icon = typeDef?.icon || BarChart3;

  if (isDragging) {
    return <div ref={setNodeRef} style={style} className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 h-[140px] opacity-40" />;
  }

  return (
    <div ref={setNodeRef} style={style} className="group">
      <Card className="glass-card hover:shadow-lg transition-all duration-300 border-t-2 overflow-hidden relative" style={{ borderTopColor: 'var(--primary)' }}>
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex items-start justify-between">
            <div className={`p-2.5 rounded-xl ${typeDef?.bg}`}>
              <Icon className={`h-5 w-5 ${typeDef?.color}`} />
            </div>
            {typeof value === 'number' && value > 0 && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px]">
                <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />Live
              </Badge>
            )}
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground font-medium">{widget.custom_label || typeDef?.label}</p>
            {widget.widget_type === 'revenue_goal_pct' ? (
              <div className="mt-2">
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold">{typeof value === 'number' ? value.toFixed(1) : '0'}%</span>
                </div>
                <Progress value={typeof value === 'number' ? Math.min(value, 100) : 0} className="mt-2 h-2" />
              </div>
            ) : widget.widget_type.includes('revenue') || widget.widget_type.includes('expense') || widget.widget_type.includes('profit') ? (
              <p className="text-2xl font-bold mt-1 tracking-tight">{formatCurrency(value || 0)}</p>
            ) : widget.widget_type === 'conversion_rate' ? (
              <p className="text-2xl font-bold mt-1">{typeof value === 'number' ? value.toFixed(1) : '0'}%</p>
            ) : (
              <p className="text-2xl font-bold mt-1">{value ?? 0}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Main KPI Dashboard Page ---
export default function KPIDashboard() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [goalValue, setGoalValue] = useState('500000');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Fetch saved widgets
  const { data: widgets = [], isLoading: widgetsLoading } = useQuery({
    queryKey: ['kpi_widgets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_widgets' as any)
        .select('*')
        .eq('user_id', user?.id)
        .order('position', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch ALL live data for widgets
  const { data: liveData = {} } = useQuery({
    queryKey: ['kpi_live_data'],
    queryFn: async () => {
      const results: Record<string, any> = {};

      // Leads
      const { data: leads } = await supabase.from('leads').select('id, status');
      results.total_leads = leads?.length || 0;
      results.won_deals = leads?.filter(l => l.status === 'deal_won')?.length || 0;
      results.conversion_rate = results.total_leads > 0 ? (results.won_deals / results.total_leads) * 100 : 0;

      // Projects
      const { data: projects } = await supabase.from('active_projects').select('id, status, total_budget, paid_amount');
      results.active_projects = projects?.filter((p: any) => p.status === 'active')?.length || 0;
      results.completed_projects = projects?.filter((p: any) => p.status === 'completed')?.length || 0;
      results.total_revenue = projects?.reduce((s: number, p: any) => s + Number(p.total_budget || 0), 0) || 0;

      // Expenses
      const { data: expenses } = await supabase.from('expenses').select('amount');
      results.total_expenses = expenses?.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) || 0;
      results.net_profit = results.total_revenue - results.total_expenses;

      // Invoices
      const { data: invoices } = await supabase.from('invoices').select('id, status');
      results.pending_invoices = invoices?.filter((i: any) => i.status !== 'paid')?.length || 0;

      // Employees
      const { data: employees } = await supabase.from('employees').select('id, status');
      results.total_employees = employees?.filter((e: any) => e.status === 'active')?.length || 0;

      // Leave
      const { data: leave } = await supabase.from('leave_applications').select('id, status');
      results.pending_leave = leave?.filter((l: any) => l.status === 'pending')?.length || 0;

      // Tickets
      const { data: tickets } = await supabase.from('it_tickets').select('id, status');
      results.open_tickets = tickets?.filter((t: any) => !['resolved', 'closed'].includes(t.status))?.length || 0;

      // Tasks
      const { data: tasks } = await supabase.from('tasks' as any).select('id, status, due_date');
      const now = new Date();
      results.overdue_tasks = tasks?.filter((t: any) => t.status !== 'completed' && t.due_date && new Date(t.due_date) < now)?.length || 0;

      // Revenue goal
      results.revenue_goal_pct = results.total_revenue > 0 ? (results.total_revenue / 500000) * 100 : 0;

      return results;
    },
    refetchInterval: 30000,
  });

  // Add widget
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('kpi_widgets' as any).insert({
        user_id: user?.id,
        widget_type: selectedType,
        custom_label: customLabel || null,
        position: widgets.length,
        config: goalValue ? { goal: Number(goalValue) } : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi_widgets'] });
      toast.success('Widget added');
      setDialogOpen(false);
      setSelectedType('');
      setCustomLabel('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete widget
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('kpi_widgets' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi_widgets'] });
      toast.success('Widget removed');
    },
  });

  // Reorder widgets
  const reorderMutation = useMutation({
    mutationFn: async (reordered: any[]) => {
      const updates = reordered.map((w, i) => 
        supabase.from('kpi_widgets' as any).update({ position: i }).eq('id', w.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi_widgets'] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = widgets.findIndex((w: any) => w.id === active.id);
    const newIndex = widgets.findIndex((w: any) => w.id === over.id);
    const reordered = arrayMove(widgets as any[], oldIndex, newIndex);
    
    // Optimistic update
    queryClient.setQueryData(['kpi_widgets', user?.id], reordered);
    reorderMutation.mutate(reordered);
  };

  // Group widget types by category
  const groupedTypes = useMemo(() => {
    const groups: Record<string, typeof WIDGET_TYPES> = {};
    WIDGET_TYPES.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, []);

  if (widgetsLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Gauge className="h-7 w-7 text-primary" />
              KPI Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Your personalized metrics — drag to reorder, all data is live.</p>
          </div>
          {role === 'admin' && (
            <Button className="gradient-primary" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Add Widget
            </Button>
          )}
        </div>

        {/* Widgets Grid */}
        {widgets.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-16 text-center">
              <Gauge className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <p className="text-muted-foreground">No KPI widgets configured yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Click "Add Widget" to start building your custom dashboard.</p>
              <Button className="gradient-primary mt-6" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />Add Your First Widget
              </Button>
            </CardContent>
          </Card>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={widgets.map((w: any) => w.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {widgets.map((widget: any) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    value={liveData[widget.widget_type]}
                    onDelete={() => deleteMutation.mutate(widget.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add Widget Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add KPI Widget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Metric *</Label>
              <div className="space-y-3 mt-2 max-h-[300px] overflow-y-auto pr-1">
                {Object.entries(groupedTypes).map(([category, types]) => (
                  <div key={category}>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{category}</p>
                    <div className="space-y-1">
                      {types.map(type => {
                        const Icon = type.icon;
                        const isSelected = selectedType === type.value;
                        return (
                          <div
                            key={type.value}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/30 hover:bg-muted/50'
                            }`}
                            onClick={() => setSelectedType(type.value)}
                          >
                            <div className={`p-1.5 rounded-lg ${type.bg}`}>
                              <Icon className={`h-4 w-4 ${type.color}`} />
                            </div>
                            <span className="text-sm font-medium">{type.label}</span>
                            {isSelected && <CheckSquare className="h-4 w-4 text-primary ml-auto" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Custom Label (optional)</Label>
              <Input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="Override the default label" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => addMutation.mutate()} disabled={!selectedType || addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Widget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
