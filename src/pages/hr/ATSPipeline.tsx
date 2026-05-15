import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Calendar, Star, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const COLUMNS = [
  { id: 'applied', title: 'Applied', color: 'bg-slate-100 dark:bg-slate-800/50' },
  { id: 'screening', title: 'Screening', color: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'interview', title: 'Interview', color: 'bg-purple-50 dark:bg-purple-900/20' },
  { id: 'offer', title: 'Offer', color: 'bg-amber-50 dark:bg-amber-900/20' },
  { id: 'hired', title: 'Hired', color: 'bg-green-50 dark:bg-green-900/20' },
  { id: 'rejected', title: 'Rejected', color: 'bg-red-50 dark:bg-red-900/20' }
];

function SortableAppCard({ app, onClick }: { app: any, onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3 cursor-grab active:cursor-grabbing">
      <Card className="hover:shadow-md transition-all border-l-4 border-l-primary relative group">
        <CardContent className="p-3">
          <div className="flex justify-between items-start">
            <h4 className="font-semibold text-sm">{app.ats_candidates?.first_name} {app.ats_candidates?.last_name}</h4>
            {app.rating > 0 && <div className="flex items-center text-amber-500 text-xs"><Star className="h-3 w-3 fill-current mr-0.5" />{app.rating}</div>}
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">{app.cms_job_openings?.title}</p>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[10px] text-muted-foreground">Applied: {new Date(app.created_at).toLocaleDateString()}</p>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onClick(); }}>
              <MoreVertical className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ATSPipeline() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['ats-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ats_applications')
        .select(`
          *,
          ats_candidates (*),
          cms_job_openings (title)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['cms_job_openings'],
    queryFn: async () => {
      const { data } = await supabase.from('cms_job_openings').select('id, title').eq('is_active', true);
      return data || [];
    }
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['ats-candidates'],
    queryFn: async () => {
      const { data } = await supabase.from('ats_candidates').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('ats_applications').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['ats-applications'] });
      const previous = qc.getQueryData(['ats-applications']);
      qc.setQueryData(['ats-applications'], (old: any) => old.map((a: any) => a.id === id ? { ...a, status } : a));
      return { previous };
    },
    onError: (err, newTodo, context: any) => qc.setQueryData(['ats-applications'], context.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: ['ats-applications'] })
  });

  const updateAppMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...data } = payload;
      const { error } = await supabase.from('ats_applications').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-applications'] });
      toast.success('Application updated');
      setDialogOpen(false);
    }
  });

  const createFormMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('ats_applications').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-applications'] });
      toast.success('Application added');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message)
  });

  const columnsData = useMemo(() => {
    const cols: Record<string, any[]> = {};
    COLUMNS.forEach(c => cols[c.id] = []);
    applications.forEach(a => { if (cols[a.status]) cols[a.status].push(a); });
    return cols;
  }, [applications]);

  const activeApp = useMemo(() => applications.find(a => a.id === activeId), [activeId, applications]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const appId = active.id as string;
    const overId = over.id as string;

    const sourceStatus = applications.find(a => a.id === appId)?.status;
    let targetStatus = overId;

    if (!COLUMNS.find(c => c.id === targetStatus)) {
      const targetApp = applications.find(a => a.id === overId);
      if (targetApp) targetStatus = targetApp.status;
    }

    if (sourceStatus && targetStatus && sourceStatus !== targetStatus && COLUMNS.find(c => c.id === targetStatus)) {
      updateStatus.mutate({ id: appId, status: targetStatus });
    }
  };

  const openAppDetails = (app: any) => { setSelectedApp(app); setDialogOpen(true); };
  const openNewApp = () => { setSelectedApp({ isNew: true, status: 'applied', rating: 0 }); setDialogOpen(true); };

  if (isLoading) return <DashboardLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-bold">Recruitment Pipeline</h1>
            <p className="text-muted-foreground">Manage applicant tracking stages</p>
          </div>
          <Button className="gradient-primary" onClick={openNewApp}><Plus className="h-4 w-4 mr-2" />Add Application</Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start h-full snap-x">
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {COLUMNS.map(col => (
              <div key={col.id} className={`w-[280px] shrink-0 rounded-xl flex flex-col max-h-full snap-center ${col.color}`}>
                <div className="p-3 font-semibold flex justify-between items-center shrink-0 border-b border-black/5 dark:border-white/5">
                  <span className="capitalize">{col.title}</span>
                  <Badge variant="secondary" className="rounded-full">{columnsData[col.id]?.length || 0}</Badge>
                </div>
                <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                  <SortableContext items={columnsData[col.id]?.map(a => a.id) || []} strategy={verticalListSortingStrategy} id={col.id}>
                    <div className="min-h-[100px]">
                      {columnsData[col.id]?.map(app => <SortableAppCard key={app.id} app={app} onClick={() => openAppDetails(app)} />)}
                    </div>
                  </SortableContext>
                </div>
              </div>
            ))}
            <DragOverlay>
              {activeApp ? (
                <Card className="shadow-2xl border-primary opacity-90 scale-105 rotate-2 cursor-grabbing">
                  <CardContent className="p-3">
                    <h4 className="font-semibold text-sm">{activeApp.ats_candidates?.first_name} {activeApp.ats_candidates?.last_name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{activeApp.cms_job_openings?.title}</p>
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={o => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedApp?.isNew ? 'New Application' : 'Application Details'}</DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4 py-4">
              {selectedApp.isNew ? (
                <>
                  <div>
                    <Label>Candidate</Label>
                    <Select value={selectedApp.candidate_id || ''} onValueChange={v => setSelectedApp({ ...selectedApp, candidate_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
                      <SelectContent>
                        {candidates.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Job Opening</Label>
                    <Select value={selectedApp.job_id || ''} onValueChange={v => setSelectedApp({ ...selectedApp, job_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
                      <SelectContent>
                        {jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="bg-muted p-3 rounded-lg flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{selectedApp.ats_candidates?.first_name} {selectedApp.ats_candidates?.last_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedApp.ats_candidates?.email} • {selectedApp.ats_candidates?.phone}</p>
                    <div className="flex gap-2 mt-2">
                      {selectedApp.ats_candidates?.resume_url && <a href={selectedApp.ats_candidates.resume_url} target="_blank" className="text-xs text-primary hover:underline">Resume</a>}
                      {selectedApp.ats_candidates?.linkedin_url && <a href={selectedApp.ats_candidates.linkedin_url} target="_blank" className="text-xs text-primary hover:underline">LinkedIn</a>}
                    </div>
                  </div>
                  <Badge>{selectedApp.cms_job_openings?.title}</Badge>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stage</Label>
                  <Select value={selectedApp.status} onValueChange={v => setSelectedApp({ ...selectedApp, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rating (1-5)</Label>
                  <Input type="number" min="0" max="5" value={selectedApp.rating || 0} onChange={e => setSelectedApp({ ...selectedApp, rating: parseInt(e.target.value) })} />
                </div>
              </div>
              
              <div>
                <Label>Expected Salary</Label>
                <Input value={selectedApp.expected_salary || ''} onChange={e => setSelectedApp({ ...selectedApp, expected_salary: e.target.value })} placeholder="e.g. $80k - $100k" />
              </div>

              <div>
                <Label>Internal Notes</Label>
                <Textarea value={selectedApp.internal_notes || ''} onChange={e => setSelectedApp({ ...selectedApp, internal_notes: e.target.value })} rows={4} placeholder="Feedback and internal discussions..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => selectedApp.isNew ? createFormMutation.mutate({
              candidate_id: selectedApp.candidate_id,
              job_id: selectedApp.job_id,
              status: selectedApp.status,
              rating: selectedApp.rating || null,
              expected_salary: selectedApp.expected_salary,
              internal_notes: selectedApp.internal_notes
            }) : updateAppMutation.mutate({
              id: selectedApp.id,
              status: selectedApp.status,
              rating: selectedApp.rating || null,
              expected_salary: selectedApp.expected_salary,
              internal_notes: selectedApp.internal_notes
            })} disabled={createFormMutation.isPending || updateAppMutation.isPending}>
              Save Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
