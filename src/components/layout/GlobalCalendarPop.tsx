import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { CalendarIcon, Clock, CheckSquare, FolderKanban, DollarSign, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface GlobalCalendarPopProps {
  children: React.ReactNode;
}

type CalendarEvent = {
  id: string;
  date: Date;
  title: string;
  type: 'task' | 'event' | 'project' | 'invoice' | 'holiday';
};

export function GlobalCalendarPop({ children }: GlobalCalendarPopProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Fetch all relevant dates
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['global_calendar_events'],
    queryFn: async () => {
      const allEvents: CalendarEvent[] = [];

      try {
        // Fetch Tasks
        const { data: tasks } = await supabase.from('tasks' as any).select('id, title, due_date, status').neq('status', 'completed');
        if (tasks) {
          tasks.forEach((t: any) => {
            if (t.due_date) allEvents.push({ id: `task-${t.id}`, date: new Date(t.due_date), title: t.title, type: 'task' });
          });
        }

        // Fetch Events
        const { data: cEvents } = await supabase.from('company_events' as any).select('id, title, event_date, description');
        if (cEvents) {
          cEvents.forEach((e: any) => {
            if (e.event_date) {
              const isHoliday = 
                e.title?.toLowerCase().includes('holiday') || 
                e.description?.toLowerCase().includes('holiday') ||
                e.title?.toLowerCase().includes('vacation') || 
                e.description?.toLowerCase().includes('vacation');
              allEvents.push({ 
                id: `event-${e.id}`, 
                date: new Date(e.event_date), 
                title: e.title, 
                type: isHoliday ? 'holiday' : 'event' 
              });
            }
          });
        }

        // Fetch Projects
        const { data: projects } = await supabase.from('active_projects').select('id, project_name, deadline').neq('status', 'completed').neq('status', 'cancelled');
        if (projects) {
          projects.forEach((p: any) => {
            if (p.deadline) allEvents.push({ id: `proj-${p.id}`, date: new Date(p.deadline), title: p.project_name, type: 'project' });
          });
        }

        // Fetch Invoices
        const { data: invoices } = await supabase.from('invoices').select('id, invoice_number, client_name, due_date').neq('status', 'paid');
        if (invoices) {
          invoices.forEach((i: any) => {
            if (i.due_date) allEvents.push({ id: `inv-${i.id}`, date: new Date(i.due_date), title: `Invoice ${i.invoice_number || ''} - ${i.client_name}`, type: 'invoice' });
          });
        }
      } catch (err) {
        console.error("Error fetching global events:", err);
      }

      return allEvents;
    }
  });

  const selectedDayEvents = events.filter(e => selectedDate && isSameDay(e.date, selectedDate));

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckSquare className="h-4 w-4 text-blue-500" />;
      case 'event': return <PartyPopper className="h-4 w-4 text-purple-500" />;
      case 'holiday': return <PartyPopper className="h-4 w-4 text-red-500" />;
      case 'project': return <FolderKanban className="h-4 w-4 text-emerald-500" />;
      case 'invoice': return <DollarSign className="h-4 w-4 text-yellow-500" />;
      default: return <CalendarIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'task': return <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-200 bg-blue-50">Task</Badge>;
      case 'event': return <Badge variant="outline" className="text-[10px] text-purple-500 border-purple-200 bg-purple-50">Meeting/Event</Badge>;
      case 'holiday': return <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 bg-red-50">Holiday</Badge>;
      case 'project': return <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-200 bg-emerald-50">Project Due</Badge>;
      case 'invoice': return <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-200 bg-yellow-50">Payment Due</Badge>;
      default: return null;
    }
  };

  const hasEventsToday = events.some(e => isSameDay(e.date, new Date()));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="hidden md:block relative">
          {children}
          {hasEventsToday && (
            <span className="absolute -top-1 -right-1 md:right-1 flex h-3 w-3 z-50">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-card dark:border-slate-900"></span>
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 rounded-2xl shadow-2xl border-border/50 bg-card/95 backdrop-blur-xl overflow-hidden" align="end" sideOffset={12}>
        <div className="p-3 border-b border-border/50 bg-primary/5">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-xl"
            modifiers={{
              holiday: (date) => events.some(e => e.type === 'holiday' && isSameDay(e.date, date)),
              hasEvent: (date) => !events.some(e => e.type === 'holiday' && isSameDay(e.date, date)) && events.some(e => isSameDay(e.date, date)),
            }}
            modifiersClassNames={{
              holiday: "text-red-500 hover:text-red-600 font-bold bg-red-50 dark:bg-red-950/20 rounded-md border border-red-100 dark:border-red-900/30",
              hasEvent: "text-primary font-bold border-b-2 border-primary/40 rounded-none",
            }}
          />
        </div>
        
        <div className="p-4 max-h-[300px] overflow-y-auto sidebar-scroll bg-card/60">
          <h4 className="text-sm font-bold mb-3 flex items-center justify-between">
            <span>{selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Agenda'}</span>
            <Badge variant="secondary" className="text-xs">{selectedDayEvents.length}</Badge>
          </h4>
          
          {isLoading ? (
            <div className="text-center py-6 text-sm text-muted-foreground animate-pulse">Loading events...</div>
          ) : selectedDayEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedDayEvents.map(event => (
                <div 
                  key={event.id} 
                  className={cn(
                    "flex gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow",
                    event.type === 'holiday' && "bg-red-50/40 border-red-100/50 dark:bg-red-950/10 dark:border-red-900/30 shadow-red-50/10"
                  )}
                >
                  <div className="mt-0.5">{getTypeIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold truncate leading-tight", event.type === 'holiday' && "text-red-600 dark:text-red-400")}>{event.title}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                        <Clock className="h-3 w-3" />
                        {format(event.date, 'h:mm a')}
                      </span>
                      {getTypeBadge(event.type)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground flex flex-col items-center gap-2">
              <CalendarIcon className="h-8 w-8 opacity-20" />
              <p>No events scheduled for this day.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
