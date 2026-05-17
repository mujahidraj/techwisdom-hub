/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActivityLog } from '@/hooks/useActivityLog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  DndContext, closestCorners, DragOverlay, useSensor, useSensors, PointerSensor,
  DragStartEvent, DragEndEvent, DragOverEvent
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import {
  Plus, GripVertical, Calendar, Loader2, Flag, LayoutGrid,
  CheckCircle2, Clock, PlayCircle, Eye, MoreVertical, Edit, Trash2,
  FileText
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';

const COLUMNS = [
  { id: 'todo', title: 'To Do', icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/40', border: 'border-slate-200 dark:border-slate-800' },
  { id: 'in_progress', title: 'In Progress', icon: PlayCircle, color: 'text-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
  { id: 'review', title: 'In Review', icon: Eye, color: 'text-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
  { id: 'completed', title: 'Done', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-400',
};

// --- Droppable Column Component ---
function KanbanColumn({ column, tasks, onEdit, onDelete, onView }: { column: typeof COLUMNS[0]; tasks: any[]; onEdit: (t: any) => void; onDelete: (id: string) => void; onView: (t: any) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const Icon = column.icon;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border ${column.border} ${column.bg} min-h-[500px] transition-all duration-300 ${isOver ? 'ring-2 ring-primary/40 scale-[1.01] shadow-lg' : ''}`}
    >
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${column.color}`} />
          <h3 className="font-bold text-sm">{column.title}</h3>
        </div>
        <Badge variant="secondary" className="text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center p-0">
          {tasks.length}
        </Badge>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] sidebar-scroll">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} onView={onView} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-xs opacity-50">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sortable Task Card ---
function SortableTaskCard({ task, onEdit, onDelete, onView }: { task: any; onEdit: (t: any) => void; onDelete: (id: string) => void; onView: (t: any) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="p-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 h-20 opacity-40"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="p-3 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 hover:border-primary/20 cursor-grab active:cursor-grabbing">
        <div className="flex items-start gap-2">
          <div {...attributes} {...listeners} className="mt-1 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(task)}>
            <div className="flex items-start justify-between gap-1">
              <p className="text-sm font-semibold leading-snug line-clamp-2 hover:text-primary transition-colors">{task.title}</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(task); }}><Eye className="h-3.5 w-3.5 mr-2" />View Details</DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(task); }}><Edit className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {task.description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <div className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${PRIORITY_COLORS[task.priority] || 'bg-slate-400'}`} />
                <span className="text-[10px] font-medium text-muted-foreground capitalize">{task.priority}</span>
              </div>
              {task.due_date && (
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-0.5">
                  <Calendar className="h-2.5 w-2.5" />
                  {format(new Date(task.due_date), 'MMM d')}
                </span>
              )}
              {task.assigned_to_name && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium">{task.assigned_to_name}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Task Card for Drag Overlay ---
function TaskCardOverlay({ task }: { task: any }) {
  return (
    <div className="p-3 rounded-xl bg-card border-2 border-primary shadow-2xl shadow-primary/20 w-[280px] rotate-2 scale-105">
      <p className="text-sm font-semibold">{task.title}</p>
      <div className="flex items-center gap-2 mt-2">
        <div className={`h-2 w-2 rounded-full ${PRIORITY_COLORS[task.priority] || 'bg-slate-400'}`} />
        <span className="text-[10px] capitalize text-muted-foreground">{task.priority}</span>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function TaskKanban() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { logActivity, logSecurity } = useActivityLog();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [viewingTask, setViewingTask] = useState<any>(null);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '', status: 'todo', assigned_to_name: '' });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Fetch all kanban tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['kanban_tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kanban_tasks' as any)
        .select('*')
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as any[];
    },
  });

  // Group tasks by status
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, any[]> = { todo: [], in_progress: [], review: [], completed: [] };
    tasks.forEach((t: any) => {
      const col = grouped[t.status] || grouped.todo;
      col.push(t);
    });
    return grouped;
  }, [tasks]);

  // Save task mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingTask) {
        const { error } = await supabase.from('kanban_tasks' as any).update({
          title: form.title,
          description: form.description,
          priority: form.priority,
          due_date: form.due_date || null,
          status: form.status,
          assigned_to_name: form.assigned_to_name || null,
        }).eq('id', editingTask.id);
        if (error) throw error;
      } else {
        const maxPos = tasks.filter((t: any) => t.status === form.status).length;
        const { error } = await supabase.from('kanban_tasks' as any).insert({
          title: form.title,
          description: form.description,
          priority: form.priority,
          due_date: form.due_date || null,
          status: form.status,
          assigned_to_name: form.assigned_to_name || null,
          position: maxPos,
          created_by: user?.id || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban_tasks'] });
      logActivity(editingTask ? 'updated' : 'created', 'task', form.title);
      logSecurity(editingTask ? 'UPDATE' : 'CREATE', 'TASK', `${editingTask ? 'Updated' : 'Created'} task "${form.title}" with status "${form.status}"`);
      toast.success(editingTask ? 'Task updated' : 'Task created');
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const task = tasks.find((t: any) => t.id === id);
      const { error } = await supabase.from('kanban_tasks' as any).delete().eq('id', id);
      if (error) throw error;
      if (task) {
        logActivity('deleted', 'task', task.title);
        logSecurity('DELETE', 'TASK', `Deleted task "${task.title}"`, id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban_tasks'] });
      toast.success('Task deleted');
    },
  });

  // Move task mutation (on drag end)
  const moveMutation = useMutation({
    mutationFn: async ({ taskId, newStatus, newPosition }: { taskId: string; newStatus: string; newPosition: number }) => {
      const { error } = await supabase.from('kanban_tasks' as any)
        .update({ status: newStatus, position: newPosition })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban_tasks'] });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTask(null);
    setForm({ title: '', description: '', priority: 'medium', due_date: '', status: 'todo', assigned_to_name: '' });
  };

  const openEdit = (task: any) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
      due_date: task.due_date ? task.due_date.slice(0, 16) : '',
      status: task.status,
      assigned_to_name: task.assigned_to_name || '',
    });
    setDialogOpen(true);
  };

  // --- Drag Handlers ---
  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t: any) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = tasks.find((t: any) => t.id === active.id);
    if (!task) return;

    // Determine which column was dropped into
    let targetColumn: string;
    const overTask = tasks.find((t: any) => t.id === over.id);
    if (overTask) {
      targetColumn = overTask.status;
    } else {
      // Dropped directly on a column
      targetColumn = over.id as string;
    }

    if (!COLUMNS.find(c => c.id === targetColumn)) return;

    const oldStatus = task.status;
    if (oldStatus !== targetColumn) {
      const newPosition = tasksByColumn[targetColumn]?.length || 0;
      moveMutation.mutate({ taskId: task.id, newStatus: targetColumn, newPosition });
      const columnLabel = COLUMNS.find(c => c.id === targetColumn)?.title || targetColumn;
      logActivity('moved', 'task', task.title, task.id, { from: oldStatus, to: targetColumn });
      logSecurity('UPDATE', 'TASK_PROGRESS', `Moved task "${task.title}" progress stage to "${columnLabel}"`, task.id);
      toast.success(`Moved "${task.title}" to ${columnLabel}`);
    }
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Optional: handle sorting within columns
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <LayoutGrid className="h-7 w-7 text-primary" />
              Task Board
            </h1>
            <p className="text-muted-foreground mt-1">Drag tasks between columns to update status</p>
          </div>
          <Button className="gradient-primary" onClick={() => { closeDialog(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />New Task
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {COLUMNS.map(col => {
            const count = tasksByColumn[col.id]?.length || 0;
            const Icon = col.icon;
            return (
              <Card key={col.id} className="glass-card">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{col.title}</p>
                    <p className="text-xl font-bold">{count}</p>
                  </div>
                  <Icon className={`h-6 w-6 ${col.color}`} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn[col.id] || []}
                onEdit={openEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onView={setViewingTask}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add details..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low"><div className="flex items-center gap-2"><Flag className="h-3 w-3 text-blue-400" />Low</div></SelectItem>
                    <SelectItem value="medium"><div className="flex items-center gap-2"><Flag className="h-3 w-3 text-amber-500" />Medium</div></SelectItem>
                    <SelectItem value="high"><div className="flex items-center gap-2"><Flag className="h-3 w-3 text-red-500" />High</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Due Date</Label>
                <Input type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div>
                <Label>Assign To</Label>
                <Input value={form.assigned_to_name} onChange={e => setForm({ ...form, assigned_to_name: e.target.value })} placeholder="Name (optional)" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title.trim()}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTask ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Task Details Dialog */}
      <Dialog open={!!viewingTask} onOpenChange={(o) => !o && setViewingTask(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border border-border/80 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-950">
          {/* Header Banner */}
          <div className="relative p-6 pb-4 bg-gradient-to-r from-primary/5 via-violet-500/5 to-transparent border-b border-border/40">
            <div className="flex items-center justify-between gap-4 mb-3">
              <Badge variant="outline" className="px-2.5 py-1 bg-background/80 backdrop-blur-sm border-border capitalize text-xs font-semibold tracking-wide flex items-center gap-1.5 shadow-sm">
                <span className={`h-2 w-2 rounded-full ${viewingTask?.status === 'completed' ? 'bg-emerald-500' :
                  viewingTask?.status === 'review' ? 'bg-amber-500' :
                    viewingTask?.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-400'
                  }`} />
                {COLUMNS.find(c => c.id === viewingTask?.status)?.title || viewingTask?.status}
              </Badge>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white ${viewingTask?.priority === 'high' ? 'bg-red-500 shadow-red-500/20' :
                  viewingTask?.priority === 'medium' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-blue-400 shadow-blue-400/20'
                  } shadow-sm`}>
                  {viewingTask?.priority} Priority
                </span>
              </div>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 leading-snug mt-2 whitespace-pre-wrap break-words pr-2">
              {viewingTask?.title}
            </DialogTitle>
          </div>

          <div className="p-6 space-y-6">
            {/* Description Card */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary/70" />
                Task Description
              </h4>
              {viewingTask?.description ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-l-4 border-l-primary/50 border-border rounded-r-xl text-sm leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words max-h-60 overflow-y-auto sidebar-scroll shadow-sm w-full overflow-x-hidden">
                  {viewingTask.description}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-l-4 border-l-slate-300 dark:border-l-slate-800 border-border rounded-r-xl text-sm text-slate-400 dark:text-slate-500 italic shadow-sm w-full">
                  No description provided for this task.
                </div>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/30">
              {/* Due Date Card */}
              <div className="p-3 bg-muted/20 dark:bg-slate-900/30 border border-border/40 rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase block">Due Date</span>
                  {viewingTask?.due_date ? (
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate mt-0.5">
                      {format(new Date(viewingTask.due_date), 'PPP, p')}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic block mt-0.5">No deadline set</span>
                  )}
                </div>
              </div>

              {/* Assignee Card */}
              <div className="p-3 bg-muted/20 dark:bg-slate-900/30 border border-border/40 rounded-xl flex items-center gap-3">
                {viewingTask?.assigned_to_name ? (
                  <>
                    <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
                      {viewingTask.assigned_to_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase block">Assigned To</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate mt-0.5">{viewingTask.assigned_to_name}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600 shrink-0 border border-dashed border-slate-200 dark:border-slate-700">
                      ?
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase block">Assigned To</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic block mt-0.5">Unassigned</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 bg-muted/10 dark:bg-slate-950/20 border-t border-border/40 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
            <Button variant="outline" className="w-full sm:w-auto font-semibold" onClick={() => setViewingTask(null)}>
              Close
            </Button>
            <Button className="gradient-primary w-full sm:w-auto font-semibold shadow-md shadow-primary/10" onClick={() => {
              const t = viewingTask;
              setViewingTask(null);
              openEdit(t);
            }}>
              <Edit className="h-4 w-4 mr-2" /> Edit Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
