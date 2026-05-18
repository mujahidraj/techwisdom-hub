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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Calendar as CalendarIcon, Clock, Video, User, CheckCircle2, AlertCircle, XCircle, Sparkles, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function Interviews() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any | null>(null);

  // Mapped interviews in memory to bypass DB relationship limits & profiles mismatches
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
          )
        `)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const interviewerIds = [...new Set(data.map(i => i.interviewer_id).filter(Boolean))];
      let profilesMap = new Map();

      if (interviewerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', interviewerIds);
        if (profiles) {
          profiles.forEach(p => profilesMap.set(p.id, p));
        }
      }

      return data.map(interview => ({
        ...interview,
        profiles: interview.interviewer_id ? profilesMap.get(interview.interviewer_id) : null
      }));
    }
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['ats-applications-list'],
    queryFn: async () => {
      const { data } = await supabase.from('ats_applications').select('id, ats_candidates(first_name, last_name), cms_job_openings(title)');
      return data || [];
    }
  });

  // Querying profiles table columns (id, full_name) to match interviewer_id foreign key format
  const { data: team = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
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
      toast.success('Interview scheduled successfully');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message)
  });

  const openNew = () => {
    setSelectedInterview({
      isNew: true,
      title: 'Initial Screening',
      status: 'scheduled',
      duration_minutes: 30,
      scheduled_at: new Date().toISOString().slice(0, 16)
    });
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
            <Clock className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600 animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Mapping interview schedule...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-12 w-full max-w-full overflow-hidden">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <CalendarIcon className="h-5 w-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Interviews</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Create, track, and monitor active candidate interview schedules.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button className="gradient-primary text-xs font-bold uppercase tracking-wider py-5 px-5 rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Interview
            </Button>
          </div>
        </div>

        {/* Interviews Cards Grid */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full">
          {interviews.map((interview: any) => {
            const isScheduled = interview.status === 'scheduled';
            const isCompleted = interview.status === 'completed';
            
            return (
              <Card 
                key={interview.id} 
                className="relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm rounded-2xl hover:shadow-md hover:scale-[1.01] transition-all duration-300 group cursor-pointer flex flex-col justify-between"
                onClick={() => { setSelectedInterview(interview); setDialogOpen(true); }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                
                <CardContent className="p-5 space-y-4">
                  {/* Top Header details inside Card */}
                  <div className="flex justify-between items-start gap-2">
                    <Badge 
                      className={`font-bold px-2 py-0.5 rounded-lg text-[10px] shadow-none ${
                        isScheduled 
                          ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                          : isCompleted 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}
                    >
                      {interview.status}
                    </Badge>
                    
                    <Badge className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-2 py-0.5 rounded-lg text-[10px] shadow-none border border-slate-200/50 dark:border-slate-700/50">
                      {interview.duration_minutes} Mins
                    </Badge>
                  </div>

                  {/* Title and Job Badge */}
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {interview.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-450 dark:text-slate-400 font-semibold">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                      {interview.ats_applications?.cms_job_openings?.title || 'General Opening'}
                    </div>
                  </div>

                  {/* Interview Info Parameters */}
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/20 pt-3 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 shrink-0">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-extrabold text-slate-700 dark:text-slate-350">
                        Candidate: {interview.ats_applications?.ats_candidates?.first_name} {interview.ats_applications?.ats_candidates?.last_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 shrink-0">
                        <CalendarIcon className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-semibold">
                        {new Date(interview.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>

                    {interview.profiles && (
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
                        </div>
                        <span className="font-semibold">
                          Interviewer: <span className="font-bold text-slate-700 dark:text-slate-300">{interview.profiles.full_name}</span>
                        </span>
                      </div>
                    )}

                    {interview.meeting_link && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100/50 dark:border-slate-850/10">
                        <Video className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        <a 
                          href={interview.meeting_link} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-xs font-black text-indigo-650 dark:text-indigo-400 hover:underline" 
                          onClick={e => e.stopPropagation()}
                        >
                          Join Meeting Video Room
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {interviews.length === 0 && (
            <Card className="bg-white/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40 col-span-full rounded-2xl">
              <CardContent className="py-16 text-center space-y-3">
                <AlertCircle className="h-12 w-12 mx-auto text-slate-400" />
                <p className="text-sm font-semibold text-slate-500">No interviews scheduled yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Schedule Interview Modal */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-2xl">
          <DialogHeader className="p-6 pb-0 relative">
            <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl">
                <Clock className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                {selectedInterview?.isNew ? 'Schedule Interview' : 'Edit Interview Schedule'}
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 pl-1">
              Select candidates, allocate interviewers, and generate video details.
            </DialogDescription>
          </DialogHeader>

          {selectedInterview && (
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div>
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Interview Title</Label>
                <Input 
                  value={selectedInterview.title || ''} 
                  onChange={e => setSelectedInterview({ ...selectedInterview, title: e.target.value })} 
                  className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Active Application</Label>
                <Select value={selectedInterview.application_id || ''} onValueChange={v => setSelectedInterview({ ...selectedInterview, application_id: v })}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                    <SelectValue placeholder="Select candidate application" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {applications.map((a: any) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs font-semibold">
                        {a.ats_candidates?.first_name} {a.ats_candidates?.last_name} - {a.cms_job_openings?.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Date & Time</Label>
                  <Input 
                    type="datetime-local" 
                    value={selectedInterview.scheduled_at ? new Date(selectedInterview.scheduled_at).toISOString().slice(0,16) : ''} 
                    onChange={e => setSelectedInterview({ ...selectedInterview, scheduled_at: new Date(e.target.value).toISOString() })} 
                    className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Duration (Minutes)</Label>
                  <Input 
                    type="number" 
                    value={selectedInterview.duration_minutes || 30} 
                    onChange={e => setSelectedInterview({ ...selectedInterview, duration_minutes: parseInt(e.target.value) })} 
                    className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Assign Interviewer</Label>
                <Select value={selectedInterview.interviewer_id || ''} onValueChange={v => setSelectedInterview({ ...selectedInterview, interviewer_id: v })}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                    <SelectValue placeholder="Select active team member" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {team.map((t: any) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs font-semibold">
                        {t.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Status</Label>
                  <Select value={selectedInterview.status || 'scheduled'} onValueChange={v => setSelectedInterview({ ...selectedInterview, status: v })}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="scheduled" className="text-xs font-semibold">Scheduled</SelectItem>
                      <SelectItem value="completed" className="text-xs font-semibold">Completed</SelectItem>
                      <SelectItem value="cancelled" className="text-xs font-semibold">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Meeting Video Link</Label>
                  <Input 
                    value={selectedInterview.meeting_link || ''} 
                    onChange={e => setSelectedInterview({ ...selectedInterview, meeting_link: e.target.value })} 
                    placeholder="https://meet.google.com/..." 
                    className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Feedback / Evaluation Notes</Label>
                <Textarea 
                  value={selectedInterview.feedback || ''} 
                  onChange={e => setSelectedInterview({ ...selectedInterview, feedback: e.target.value })} 
                  rows={2} 
                  placeholder="Evaluation summary, follow-up parameters, candidate answers..." 
                  className="rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold resize-none"
                />
              </div>

              <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 border-t border-slate-100 dark:border-slate-800/30">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  className="rounded-xl text-xs font-bold px-5 h-11 border-slate-200 dark:border-slate-800"
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={() => saveMutation.mutate(selectedInterview)} 
                  disabled={saveMutation.isPending}
                  className="rounded-xl text-xs font-bold px-5 h-11 gradient-primary shadow-sm"
                >
                  {saveMutation.isPending ? (
                    'Saving...'
                  ) : (
                    <>
                      Save Interview
                      <Send className="h-3.5 w-3.5 ml-2" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
