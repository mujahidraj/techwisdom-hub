/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { 
  Calendar as CalendarIcon, CheckSquare, Plus, Trash2, MapPin, 
  Clock, MoreVertical, Edit
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function EventsTasks() {
  const queryClient = useQueryClient();
  const { sendNotification } = useNotifications();
  
  // Dialog States
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);
  
  // Edit Modes
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  // Forms
  const [taskForm, setTaskForm] = useState({ title: '', priority: 'medium', due_date: '' });
  const [eventForm, setEventForm] = useState({ title: '', description: '', event_date: '', location: '' });

  // --- 1. FETCH TASKS ---
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      // FIX: Added 'as any' to bypass type check for new table
      const { data, error } = await supabase
        .from('tasks' as any)
        .select('*')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // --- 2. FETCH EVENTS ---
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      // FIX: Added 'as any' to bypass type check for new table
      const { data, error } = await supabase
        .from('company_events' as any)
        .select('*')
        .order('event_date', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // --- 3. TASK MUTATIONS ---
  const saveTaskMutation = useMutation({
    mutationFn: async () => {
      if (editingTask) {
        const { error } = await supabase.from('tasks' as any).update(taskForm).eq('id', editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks' as any).insert(taskForm);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsTaskOpen(false);
      resetForms();
      toast.success(editingTask ? "Task updated" : "Task created");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (task: any) => {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const { error } = await supabase.from('tasks' as any).update({ status: newStatus }).eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success("Task deleted");
    }
  });

  // --- 4. EVENT MUTATIONS ---
  const saveEventMutation = useMutation({
    mutationFn: async () => {
      if (editingEvent) {
        const { error } = await supabase.from('company_events' as any).update(eventForm).eq('id', editingEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('company_events' as any).insert(eventForm);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
      // Notify everyone about the new event
      if (!editingEvent) {
        sendNotification({
          title: 'New Company Event',
          message: `${eventForm.title} scheduled for ${format(new Date(eventForm.event_date), 'PPP p')}`,
          type: 'info',
          targetRoles: ['employee', 'admin'],
          actionLink: '/employee-portal'
        });
      }

      setIsEventOpen(false);
      resetForms();
      toast.success(editingEvent ? "Event updated" : "Event scheduled");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('company_events' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success("Event removed");
    }
  });

  // Helpers
  const resetForms = () => {
    setTaskForm({ title: '', priority: 'medium', due_date: '' });
    setEventForm({ title: '', description: '', event_date: '', location: '' });
    setEditingTask(null);
    setEditingEvent(null);
  };

  const openEditTask = (task: any) => {
    setEditingTask(task);
    setTaskForm({ title: task.title, priority: task.priority, due_date: task.due_date ? task.due_date.slice(0,16) : '' });
    setIsTaskOpen(true);
  };

  const openEditEvent = (event: any) => {
    setEditingEvent(event);
    setEventForm({ title: event.title, description: event.description || '', event_date: event.event_date.slice(0,16), location: event.location });
    setIsEventOpen(true);
  };

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'high': return 'text-red-600 bg-red-50 border-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-100';
      default: return 'text-blue-600 bg-blue-50 border-blue-100';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-8 w-8 text-primary" /> Schedule & Tasks
            </h1>
            <p className="text-muted-foreground">Manage your daily priorities and upcoming agenda.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          
          {/* --- LEFT: TASKS --- */}
          <Card className="flex flex-col h-full glass-card border-t-4 border-t-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-blue-500" /> My Tasks
              </CardTitle>
              <Button size="sm" onClick={() => { resetForms(); setIsTaskOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> New Task
              </Button>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">No tasks pending. You're all clear!</p>
                ) : tasks.map((task: any) => (
                  <div key={task.id} className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${task.status === 'completed' ? 'bg-muted/50 opacity-60' : 'bg-white hover:shadow-sm'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Checkbox 
                        checked={task.status === 'completed'} 
                        onCheckedChange={() => toggleTaskMutation.mutate(task)} 
                      />
                      <div className="min-w-0">
                        <p className={`font-medium truncate ${task.status === 'completed' ? 'line-through' : ''}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize border-0 ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </Badge>
                          {task.due_date && (
                            <span className={`text-[10px] flex items-center gap-1 ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                              <Clock className="h-3 w-3" />
                              {format(new Date(task.due_date), 'MMM d, h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditTask(task)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => deleteTaskMutation.mutate(task.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* --- RIGHT: EVENTS --- */}
          <Card className="flex flex-col h-full glass-card border-t-4 border-t-purple-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-purple-500" /> Upcoming Events
              </CardTitle>
              <Button size="sm" variant="secondary" onClick={() => { resetForms(); setIsEventOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Event
              </Button>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                {events.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">No upcoming events.</p>
                ) : events.map((event: any) => (
                  <div key={event.id} className="group relative flex gap-4 p-4 rounded-xl bg-purple-50/50 border border-purple-100 hover:bg-purple-50 transition-colors">
                    {/* Date Box */}
                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-white rounded-lg border shadow-sm shrink-0">
                      <span className="text-[10px] font-bold text-red-500 uppercase">{format(new Date(event.event_date), 'MMM')}</span>
                      <span className="text-xl font-bold text-gray-900">{format(new Date(event.event_date), 'd')}</span>
                    </div>
                    
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{event.title}</h4>
                      <div className="flex flex-col gap-1 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-purple-500" />
                          {format(new Date(event.event_date), 'EEEE, h:mm a')}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-purple-500" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-white shadow-sm" onClick={() => openEditEvent(event)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-white shadow-sm text-red-500 hover:text-red-600" onClick={() => deleteEventMutation.mutate(event.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* --- TASK DIALOG --- */}
        <Dialog open={isTaskOpen} onOpenChange={setIsTaskOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Input placeholder="Task Title" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select value={taskForm.priority} onValueChange={val => setTaskForm({...taskForm, priority: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => saveTaskMutation.mutate()} disabled={!taskForm.title}>Save Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- EVENT DIALOG --- */}
        <Dialog open={isEventOpen} onOpenChange={setIsEventOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingEvent ? 'Edit Event' : 'New Event'}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <Input placeholder="Event Title" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
              <Input placeholder="Description (Optional)" value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} />
              <Input placeholder="Location (Optional)" value={eventForm.location} onChange={e => setEventForm({...eventForm, location: e.target.value})} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">Event Date & Time</label>
                <Input type="datetime-local" value={eventForm.event_date} onChange={e => setEventForm({...eventForm, event_date: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => saveEventMutation.mutate()} disabled={!eventForm.title || !eventForm.event_date}>Save Event</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}