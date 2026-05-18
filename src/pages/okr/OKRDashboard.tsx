import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Target, ChevronRight, CheckCircle2, AlertCircle, AlertTriangle, TrendingUp, Key } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';

export default function OKRDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { sendNotification } = useNotifications();
  const [cycle, setCycle] = useState('Q2 2026');
  
  // Dialogs
  const [objDialogOpen, setObjDialogOpen] = useState(false);
  const [krDialogOpen, setKrDialogOpen] = useState(false);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  
  const [selectedObj, setSelectedObj] = useState<any | null>(null);
  const [selectedKr, setSelectedKr] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});

  const { data: team = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    }
  });

  const { data: okrs = [], isLoading } = useQuery({
    queryKey: ['okrs', cycle],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('okr_objectives')
        .select(`
          *,
          okr_key_results (
            *,
            okr_check_ins (*)
          )
        `)
        .eq('cycle', cycle)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const saveObjective = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('okr_objectives').insert(payload);
      if (error) throw error;

      if (payload.owner_id) {
        await sendNotification({
          userId: payload.owner_id,
          title: 'New OKR Objective Assigned',
          message: `You have been assigned a new objective: "${payload.title}" for ${payload.cycle}.`,
          type: 'info'
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['okrs'] });
      toast.success('Objective created');
      setObjDialogOpen(false);
    }
  });

  const saveKeyResult = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('okr_key_results').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['okrs'] });
      toast.success('Key Result created');
      setKrDialogOpen(false);
    }
  });

  const saveCheckIn = useMutation({
    mutationFn: async (payload: any) => {
      // 1. Insert check-in
      const { error: ciError } = await supabase.from('okr_check_ins').insert({
        key_result_id: payload.kr_id,
        previous_value: payload.prev_val,
        new_value: payload.new_val,
        notes: payload.notes,
        created_by: user?.id
      });
      if (ciError) throw ciError;

      // 2. Update KR current_value
      const { error: krError } = await supabase.from('okr_key_results').update({ current_value: payload.new_val }).eq('id', payload.kr_id);
      if (krError) throw krError;

      // 3. Recalculate Objective Progress
      const obj = okrs.find(o => o.id === payload.obj_id);
      if (obj && obj.okr_key_results) {
        let totalProgress = 0;
        let count = 0;
        obj.okr_key_results.forEach(kr => {
          const val = kr.id === payload.kr_id ? payload.new_val : kr.current_value;
          totalProgress += Math.min(100, Math.max(0, (val / kr.target_value) * 100));
          count++;
        });
        const avg = count === 0 ? 0 : Math.round(totalProgress / count);
        await supabase.from('okr_objectives').update({ progress: avg }).eq('id', payload.obj_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['okrs'] });
      toast.success('Check-in saved');
      setCheckInDialogOpen(false);
    }
  });

  const openNewObj = () => { setFormData({ level: 'individual', cycle, progress: 0 }); setObjDialogOpen(true); };
  const openNewKr = (objId: string) => { setFormData({ objective_id: objId, current_value: 0 }); setKrDialogOpen(true); };
  const openCheckIn = (objId: string, kr: any) => { 
    setSelectedObj(objId); 
    setSelectedKr(kr); 
    setFormData({ new_val: kr.current_value, notes: '' }); 
    setCheckInDialogOpen(true); 
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'on_track': return <CheckCircle2 className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />;
      case 'at_risk': return <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />;
      case 'off_track': return <AlertCircle className="h-4 w-4 text-rose-500 dark:text-rose-400" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />;
      default: return null;
    }
  };

  const getStatusColorClass = (status: string) => {
    switch(status) {
      case 'completed': return 'border-l-4 border-l-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.08)]';
      case 'on_track': return 'border-l-4 border-l-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.08)]';
      case 'at_risk': return 'border-l-4 border-l-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.08)]';
      default: return 'border-l-4 border-l-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.08)]';
    }
  };

  const getStatusBadge = (status: string) => {
    const base = "text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 capitalize tracking-wide ";
    switch(status) {
      case 'completed': return <span className={base + "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}>{getStatusIcon(status)} Completed</span>;
      case 'on_track': return <span className={base + "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"}>{getStatusIcon(status)} On Track</span>;
      case 'at_risk': return <span className={base + "bg-amber-500/10 text-amber-600 border-amber-500/20"}>{getStatusIcon(status)} At Risk</span>;
      default: return <span className={base + "bg-rose-500/10 text-rose-600 border-rose-500/20"}>{getStatusIcon(status)} Off Track</span>;
    }
  };

  const renderObjCard = (obj: any) => {
    const ownerName = team.find((t: any) => t.id === obj.owner_id)?.full_name || 'Unassigned';
    return (
      <Card key={obj.id} className={`mb-6 overflow-hidden glass-card border border-border/40 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 transform hover:-translate-y-0.5 rounded-2xl ${getStatusColorClass(obj.status)}`}>
        <div className="bg-card/30 dark:bg-slate-900/30 p-5 border-b border-border/40 flex justify-between items-start">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/10 px-2.5 py-0.5 text-xs font-semibold capitalize tracking-wide shadow-none">
                {obj.level}
              </Badge>
              {getStatusBadge(obj.status)}
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 leading-tight tracking-tight">{obj.title}</h3>
            {obj.description && <p className="text-sm text-muted-foreground">{obj.description}</p>}
            
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-1.5 bg-muted/65 dark:bg-slate-800/65 px-3 py-1 rounded-full text-xs font-medium border border-border/30 shadow-sm text-slate-600 dark:text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Owner: <span className="font-bold text-slate-700 dark:text-slate-200">{ownerName}</span>
              </div>
              {obj.department && (
                <div className="bg-muted/40 dark:bg-slate-800/40 px-2.5 py-1 rounded-full text-xs font-medium border border-border/20 text-slate-500">
                  Dept: {obj.department}
                </div>
              )}
            </div>
          </div>
          
          <div className="text-right ml-4 w-32 shrink-0 flex flex-col justify-center items-end">
            <div className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 flex items-baseline">
              {obj.progress || 0}<span className="text-sm font-semibold text-muted-foreground ml-0.5">%</span>
            </div>
            <Progress value={obj.progress || 0} className="h-2 w-full mt-2 bg-slate-100 dark:bg-slate-800 overflow-hidden" />
          </div>
        </div>
        
        <div className="bg-muted/10 dark:bg-slate-900/10 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Key className="h-4 w-4 text-primary/80" /> Key Results
            </h4>
            <Button variant="outline" size="sm" className="h-8 text-xs px-3 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all duration-200 rounded-lg shadow-sm" onClick={() => openNewKr(obj.id)}>
              <Plus className="h-3 w-3 mr-1" /> Add Key Result
            </Button>
          </div>
          
          <div className="space-y-3">
            {(!obj.okr_key_results || obj.okr_key_results.length === 0) ? (
              <div className="text-center py-6 border border-dashed rounded-xl border-border/60 bg-background/50">
                <p className="text-xs text-muted-foreground italic">No key results defined for this objective yet.</p>
              </div>
            ) : null}
            {obj.okr_key_results?.map((kr: any) => {
              const krProgress = Math.min(100, Math.round((kr.current_value / kr.target_value) * 100));
              return (
                <div key={kr.id} className="bg-card/40 dark:bg-slate-900/40 backdrop-blur-sm border border-border/40 hover:border-primary/20 rounded-xl p-4 flex justify-between items-center group transition-all duration-200 shadow-sm">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{kr.title}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-muted px-2 py-0.5 rounded border border-border/20">
                        {kr.current_value} / {kr.target_value} {kr.unit}
                      </div>
                      <Progress value={krProgress} className="h-1.5 flex-1 max-w-[200px]" />
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm hover:bg-primary hover:text-white rounded-lg h-8 px-3" onClick={() => openCheckIn(obj.id, kr)}>
                    <TrendingUp className="h-3 w-3 mr-1" /> Check-in
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    );
  }

  if (isLoading) return <DashboardLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;

  const companyOkrs = okrs.filter(o => o.level === 'company');
  const deptOkrs = okrs.filter(o => o.level === 'department');
  const indOkrs = okrs.filter(o => o.level === 'individual');

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Target className="h-8 w-8 text-primary" /> OKRs & Goals</h1>
            <p className="text-muted-foreground">Align objectives and track measurable outcomes</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={cycle} onValueChange={setCycle}>
              <SelectTrigger className="w-[120px] bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Q1 2026">Q1 2026</SelectItem>
                <SelectItem value="Q2 2026">Q2 2026</SelectItem>
                <SelectItem value="Q3 2026">Q3 2026</SelectItem>
                <SelectItem value="Q4 2026">Q4 2026</SelectItem>
                <SelectItem value="2026 Annual">2026 Annual</SelectItem>
              </SelectContent>
            </Select>
            <Button className="gradient-primary" onClick={openNewObj}><Plus className="h-4 w-4 mr-2" />New Objective</Button>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start border border-border/40 rounded-2xl h-auto p-1.5 bg-muted/20 backdrop-blur-md mb-8 flex-wrap md:flex-nowrap gap-1">
            <TabsTrigger value="all" className="rounded-xl py-2 px-5 text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">All OKRs</TabsTrigger>
            <TabsTrigger value="company" className="rounded-xl py-2 px-5 text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">Company Level</TabsTrigger>
            <TabsTrigger value="department" className="rounded-xl py-2 px-5 text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">Department Level</TabsTrigger>
            <TabsTrigger value="individual" className="rounded-xl py-2 px-5 text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">Individual</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="m-0 space-y-8">
            {companyOkrs.length > 0 && <div><h2 className="text-xl font-semibold mb-4 border-b pb-2">Company Objectives</h2>{companyOkrs.map(renderObjCard)}</div>}
            {deptOkrs.length > 0 && <div><h2 className="text-xl font-semibold mb-4 border-b pb-2">Department Objectives</h2>{deptOkrs.map(renderObjCard)}</div>}
            {indOkrs.length > 0 && <div><h2 className="text-xl font-semibold mb-4 border-b pb-2">Individual Objectives</h2>{indOkrs.map(renderObjCard)}</div>}
            {okrs.length === 0 && <div className="text-center py-20 text-muted-foreground"><Target className="h-12 w-12 mx-auto mb-4 opacity-20" /><p>No objectives found for {cycle}</p></div>}
          </TabsContent>
          <TabsContent value="company" className="m-0">{companyOkrs.map(renderObjCard)}{companyOkrs.length === 0 && <p className="text-muted-foreground py-8">No company OKRs.</p>}</TabsContent>
          <TabsContent value="department" className="m-0">{deptOkrs.map(renderObjCard)}{deptOkrs.length === 0 && <p className="text-muted-foreground py-8">No department OKRs.</p>}</TabsContent>
          <TabsContent value="individual" className="m-0">{indOkrs.map(renderObjCard)}{indOkrs.length === 0 && <p className="text-muted-foreground py-8">No individual OKRs.</p>}</TabsContent>
        </Tabs>
      </div>

      {/* CREATE OBJECTIVE DIALOG */}
      <Dialog open={objDialogOpen} onOpenChange={o => !o && setObjDialogOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Objective</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Objective Title</Label>
              <Input placeholder="e.g. Launch new mobile app" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Level</Label>
                <Select value={formData.level} onValueChange={v => setFormData({ ...formData, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="company">Company</SelectItem><SelectItem value="department">Department</SelectItem><SelectItem value="individual">Individual</SelectItem></SelectContent>
                </Select>
              </div>
              {formData.level === 'department' && (
                <div>
                  <Label>Department</Label>
                  <Input value={formData.department || ''} onChange={e => setFormData({ ...formData, department: e.target.value })} />
                </div>
              )}
              <div>
                <Label>Owner</Label>
                <Select value={formData.owner_id || ''} onValueChange={v => setFormData({ ...formData, owner_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                  <SelectContent>{team.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name || 'Unknown'}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => saveObjective.mutate(formData)} disabled={saveObjective.isPending || !formData.title}>Create Objective</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE KEY RESULT DIALOG */}
      <Dialog open={krDialogOpen} onOpenChange={o => !o && setKrDialogOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Key Result</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Key Result Title</Label>
              <Input placeholder="e.g. Achieve 10,000 monthly active users" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Target Value</Label>
                <Input type="number" value={formData.target_value || ''} onChange={e => setFormData({ ...formData, target_value: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Unit (e.g., %, $, users)</Label>
                <Input value={formData.unit || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="%" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKrDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => saveKeyResult.mutate(formData)} disabled={saveKeyResult.isPending || !formData.title || !formData.target_value}>Save Key Result</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CHECK-IN DIALOG */}
      <Dialog open={checkInDialogOpen} onOpenChange={o => !o && setCheckInDialogOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Progress Check-in</DialogTitle></DialogHeader>
          {selectedKr && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-3 rounded-md text-sm">
                <p className="font-semibold">{selectedKr.title}</p>
                <p className="text-muted-foreground mt-1">Current: {selectedKr.current_value} / Target: {selectedKr.target_value} {selectedKr.unit}</p>
              </div>
              <div>
                <Label>New Value ({selectedKr.unit})</Label>
                <Input type="number" value={formData.new_val || ''} onChange={e => setFormData({ ...formData, new_val: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Notes / Updates</Label>
                <Textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="What progress was made?" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckInDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => saveCheckIn.mutate({ obj_id: selectedObj, kr_id: selectedKr?.id, prev_val: selectedKr?.current_value, new_val: formData.new_val, notes: formData.notes })} disabled={saveCheckIn.isPending}>Save Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
