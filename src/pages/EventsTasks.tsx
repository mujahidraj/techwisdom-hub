/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { useActivityLog } from '@/hooks/useActivityLog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, isSameDay, isPast, isToday, isTomorrow, isThisWeek } from 'date-fns';
import {
  Calendar as CalendarIcon, Plus, Trash2, MapPin,
  Clock, Edit, Sparkles, PartyPopper, Loader2, Search
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function EventsTasks() {
  const queryClient = useQueryClient();
  const { sendNotification } = useNotifications();
  const { logActivity, logSecurity } = useActivityLog();

  const [isEventOpen, setIsEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventForm, setEventForm] = useState({ title: '', description: '', event_date: '', location: '' });

  // Fetch events
  const { data: events = [] as any[], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_events' as any)
        .select('*')
        .order('event_date', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  // Save event
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
      logActivity(editingEvent ? 'updated' : 'created', 'event', eventForm.title);
      logSecurity(editingEvent ? 'UPDATE' : 'CREATE', 'EVENT', `${editingEvent ? 'Updated' : 'Scheduled'} company event "${eventForm.title}" for ${eventForm.event_date}`);
      if (!editingEvent) {
        sendNotification({
          title: 'New Company Event',
          message: `${eventForm.title} scheduled for ${format(new Date(eventForm.event_date), 'PPP p')}`,
          type: 'info',
          targetRoles: ['employee', 'admin'],
          actionLink: '/employee-portal'
        });
      }
      closeDialog();
      toast.success(editingEvent ? 'Event updated' : 'Event scheduled');
    },
    onError: (err: any) => toast.error(err.message)
  });

  // Delete event
  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const eventItem = events.find((e: any) => e.id === id);
      const { error } = await supabase.from('company_events' as any).delete().eq('id', id);
      if (error) throw error;
      if (eventItem) {
        logActivity('deleted', 'event', eventItem.title);
        logSecurity('DELETE', 'EVENT', `Removed company event "${eventItem.title}"`, id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event removed');
    }
  });

  const closeDialog = () => {
    setIsEventOpen(false);
    setEditingEvent(null);
    setEventForm({ title: '', description: '', event_date: '', location: '' });
  };

  const openEdit = (event: any) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date?.slice(0, 16) || '',
      location: event.location || ''
    });
    setIsEventOpen(true);
  };

  const openCreate = () => {
    closeDialog();
    if (selectedDate) {
      const dateStr = format(selectedDate, "yyyy-MM-dd'T'09:00");
      setEventForm({ title: '', description: '', event_date: dateStr, location: '' });
    }
    setIsEventOpen(true);
  };

  // Dates that have events (for calendar dots)
  const eventDates = useMemo(() => {
    return events.map((e: any) => new Date(e.event_date));
  }, [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    let filtered = events as any[];
    if (selectedDate) {
      filtered = filtered.filter((e: any) => isSameDay(new Date(e.event_date), selectedDate));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e: any) =>
        e.title?.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [events, selectedDate, searchQuery]);

  // Upcoming events (next 5, regardless of filter)
  const upcomingEvents = useMemo(() => {
    return (events as any[])
      .filter((e: any) => new Date(e.event_date) >= new Date())
      .slice(0, 5);
  }, [events]);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d');
  };

  const stats = useMemo(() => {
    const now = new Date();
    const all = events as any[];
    return {
      total: all.length,
      upcoming: all.filter((e: any) => new Date(e.event_date) >= now).length,
      today: all.filter((e: any) => isToday(new Date(e.event_date))).length,
      thisWeek: all.filter((e: any) => isThisWeek(new Date(e.event_date))).length,
    };
  }, [events]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              Event Schedule
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">Organize and track your company events, meetings & milestones.</p>
          </div>
          <Button className="gradient-primary shadow-lg" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />New Event
          </Button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Events', value: stats.total, color: 'from-violet-500 to-purple-600' },
            { label: 'Upcoming', value: stats.upcoming, color: 'from-blue-500 to-cyan-500' },
            { label: 'Today', value: stats.today, color: 'from-emerald-500 to-green-500' },
            { label: 'This Week', value: stats.thisWeek, color: 'from-amber-500 to-orange-500' },
          ].map(stat => (
            <Card key={stat.label} className="glass-card overflow-hidden group hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg group-hover:scale-110 transition-transform`}>
                  <CalendarIcon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

          {/* Left: Calendar Picker */}
          <div className="space-y-4">
            <Card className="glass-card">
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => setSelectedDate(d)}
                  modifiers={{ hasEvent: eventDates }}
                  modifiersStyles={{
                    hasEvent: {
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      textDecorationColor: 'hsl(var(--primary))',
                      textUnderlineOffset: '4px'
                    }
                  }}
                  className="w-full"
                />
                <div className="mt-3 flex items-center gap-3 pt-3 border-t border-border/40">
                  <Button variant="ghost" size="sm" className="text-xs flex-1" onClick={() => setSelectedDate(new Date())}>
                    <Sparkles className="h-3 w-3 mr-1" />Today
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs flex-1 text-muted-foreground" onClick={() => setSelectedDate(undefined)}>
                    Show All
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Preview */}
            <Card className="glass-card hidden lg:block">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Next Up</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0">
                {upcomingEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No upcoming events</p>
                ) : upcomingEvents.map((event: any) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedDate(new Date(event.event_date));
                    }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex flex-col items-center justify-center shrink-0 shadow-sm">
                      <span className="text-[8px] font-bold text-white/80 uppercase leading-none">{format(new Date(event.event_date), 'MMM')}</span>
                      <span className="text-sm font-bold text-white leading-none">{format(new Date(event.event_date), 'd')}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{event.title}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(event.event_date), 'h:mm a')}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right: Event List */}
          <Card className="glass-card flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PartyPopper className="h-4 w-4 text-violet-500" />
                  {selectedDate ? getDateLabel(selectedDate) : 'All Events'}
                  <Badge variant="secondary" className="ml-1 text-xs rounded-full">{filteredEvents.length}</Badge>
                </CardTitle>
                <div className="relative w-full sm:w-52">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-xs"
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px] px-4 pb-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/20 mb-4">
                      <CalendarIcon className="h-10 w-10 text-violet-400" />
                    </div>
                    <p className="font-semibold text-sm">No events {selectedDate ? 'on this day' : 'found'}</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                      {selectedDate ? 'Select another date or create a new event.' : 'Try a different search term.'}
                    </p>
                    <Button size="sm" className="mt-4 gradient-primary" onClick={openCreate}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />Schedule Event
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents.map((event: any, index: number) => {
                      const eventDate = new Date(event.event_date);
                      const isExpired = isPast(eventDate) && !isToday(eventDate);
                      const isHoliday = /holiday|vacation|off day/i.test(event.title + ' ' + (event.description || ''));

                      return (
                        <div
                          key={event.id}
                          className={`group relative flex gap-4 p-4 rounded-2xl border transition-all duration-200 animate-in fade-in slide-in-from-bottom-1 hover:shadow-md ${
                            isHoliday
                              ? 'bg-red-50/60 dark:bg-red-900/10 border-red-200 dark:border-red-800/40'
                              : isExpired
                                ? 'bg-muted/30 border-border/30 opacity-60'
                                : 'bg-card border-border/50 hover:border-violet-200 dark:hover:border-violet-800'
                          }`}
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          {/* Date Badge */}
                          <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl shrink-0 shadow-sm ${
                            isHoliday
                              ? 'bg-gradient-to-br from-red-500 to-rose-600'
                              : isToday(eventDate)
                                ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                                : 'bg-gradient-to-br from-violet-500 to-purple-600'
                          }`}>
                            <span className="text-[9px] font-bold text-white/80 uppercase leading-none">
                              {format(eventDate, 'MMM')}
                            </span>
                            <span className="text-lg font-bold text-white leading-none">
                              {format(eventDate, 'd')}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <h4 className={`font-semibold text-sm leading-snug ${isExpired ? 'line-through' : ''}`}>
                                {event.title}
                              </h4>
                              {isToday(eventDate) && (
                                <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0 shrink-0">Today</Badge>
                              )}
                              {isHoliday && (
                                <Badge className="bg-red-500 text-white text-[9px] px-1.5 py-0 shrink-0">Holiday</Badge>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3 text-violet-500" />
                                {format(eventDate, 'EEEE, h:mm a')}
                              </span>
                              {event.location && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-violet-500" />
                                  {event.location}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEdit(event)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" onClick={() => deleteEventMutation.mutate(event.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event Dialog */}
      <Dialog open={isEventOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-violet-500" />
              {editingEvent ? 'Edit Event' : 'Schedule New Event'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Event Title *</Label>
              <Input
                value={eventForm.title}
                onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="e.g. Team Standup, Client Demo, Holiday..."
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={eventForm.description}
                onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Add details about the event..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Date & Time *</Label>
                <Input
                  type="datetime-local"
                  value={eventForm.event_date}
                  onChange={e => setEventForm({ ...eventForm, event_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={eventForm.location}
                  onChange={e => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="Office, Zoom, etc."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              className="gradient-primary"
              onClick={() => saveEventMutation.mutate()}
              disabled={!eventForm.title.trim() || !eventForm.event_date || saveEventMutation.isPending}
            >
              {saveEventMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEvent ? 'Save Changes' : 'Schedule Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}