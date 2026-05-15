import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Calendar as CalendarIcon, Clock, Video, User } from 'lucide-react';
import { toast } from 'sonner';

export default function Interviews() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any | null>(null);

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ['ats-interviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ats_interviews')
        .select(`
          *,
          ats_applications (
            id,
            job_id,
            ats_candidates (first_name, last_name, email),
            cms_job_openings (title)
          ),
          profiles:interviewer_id (first_name, last_name)
        `)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['ats-applications-list'],
    queryFn: async () => {
      const { data } = await supabase.from('ats_applications').select('id, ats_candidates(first_name, last_name), cms_job_openings(title)');
      return data || [];
    }
  });

  const { data: team = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name');
      return data || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { isNew, ats_applications, profiles, ...data } = payload;
      if (isNew) {
        const { error } = await supabase.from('ats_interviews').insert(data);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ats_interviews').update(data).eq('id', data.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-interviews'] });
      toast.success('Interview saved');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message)
  });

  const openNew = () => {
    setSelectedInterview({
      isNew: true,
      title: 'Initial Interview',
      status: 'scheduled',
      duration_minutes: 30,
      scheduled_at: new Date().toISOString().slice(0, 16)
    });
    setDialogOpen(true);
  };

  if (isLoading) return <DashboardLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Interviews</h1>
            <p className="text-muted-foreground">Manage candidate interviews</p>
          </div>
          <Button className="gradient-primary" onClick={openNew}><Plus className="h-4 w-4 mr-2" />Schedule Interview</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {interviews.map((interview: any) => (
            <Card key={interview.id} className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-primary" onClick={() => { setSelectedInterview(interview); setDialogOpen(true); }}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={interview.status === 'scheduled' ? 'default' : interview.status === 'completed' ? 'secondary' : 'destructive'}>
                    {interview.status}
                  </Badge>
                  <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-md">{interview.duration_minutes} min</span>
                </div>
                
                <h3 className="font-bold text-lg mb-1">{interview.title}</h3>
                
                <div className="space-y-2 mt-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span className="font-medium text-foreground">
                      {interview.ats_applications?.ats_candidates?.first_name} {interview.ats_applications?.ats_candidates?.last_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{new Date(interview.scheduled_at).toLocaleString()}</span>
                  </div>
                  {interview.profiles && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Interviewer: {interview.profiles.first_name} {interview.profiles.last_name}</span>
                    </div>
                  )}
                  {interview.meeting_link && (
                    <div className="flex items-center gap-2 text-muted-foreground pt-2">
                      <Video className="h-4 w-4 text-primary" />
                      <a href={interview.meeting_link} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>Join Meeting</a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {interviews.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">No interviews scheduled.</div>}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={o => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{selectedInterview?.isNew ? 'Schedule Interview' : 'Edit Interview'}</DialogTitle></DialogHeader>
          {selectedInterview && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Interview Title</Label>
                <Input value={selectedInterview.title || ''} onChange={e => setSelectedInterview({ ...selectedInterview, title: e.target.value })} />
              </div>
              
              {selectedInterview.isNew && (
                <div>
                  <Label>Application</Label>
                  <Select value={selectedInterview.application_id || ''} onValueChange={v => setSelectedInterview({ ...selectedInterview, application_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select application" /></SelectTrigger>
                    <SelectContent>
                      {applications.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.ats_candidates?.first_name} {a.ats_candidates?.last_name} - {a.cms_job_openings?.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date & Time</Label>
                  <Input type="datetime-local" value={selectedInterview.scheduled_at ? new Date(selectedInterview.scheduled_at).toISOString().slice(0,16) : ''} onChange={e => setSelectedInterview({ ...selectedInterview, scheduled_at: new Date(e.target.value).toISOString() })} />
                </div>
                <div>
                  <Label>Duration (mins)</Label>
                  <Input type="number" value={selectedInterview.duration_minutes || 30} onChange={e => setSelectedInterview({ ...selectedInterview, duration_minutes: parseInt(e.target.value) })} />
                </div>
              </div>

              <div>
                <Label>Interviewer</Label>
                <Select value={selectedInterview.interviewer_id || ''} onValueChange={v => setSelectedInterview({ ...selectedInterview, interviewer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select interviewer" /></SelectTrigger>
                  <SelectContent>
                    {team.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={selectedInterview.status || 'scheduled'} onValueChange={v => setSelectedInterview({ ...selectedInterview, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Meeting Link</Label>
                <Input value={selectedInterview.meeting_link || ''} onChange={e => setSelectedInterview({ ...selectedInterview, meeting_link: e.target.value })} placeholder="https://meet.google.com/..." />
              </div>

              <div>
                <Label>Feedback / Notes</Label>
                <Textarea value={selectedInterview.feedback || ''} onChange={e => setSelectedInterview({ ...selectedInterview, feedback: e.target.value })} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => saveMutation.mutate(selectedInterview)} disabled={saveMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
