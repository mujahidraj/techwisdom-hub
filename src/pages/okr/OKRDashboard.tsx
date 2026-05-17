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

export default function OKRDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
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
      const { data } = await supabase.from('profiles').select('id, first_name, last_name');
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
          profiles:owner_id (first_name, last_name),
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
      case 'on_track': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'at_risk': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'off_track': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'completed': return <Target className="h-4 w-4 text-primary" />;
      default: return null;
    }
  };

  const renderObjCard = (obj: any) => (
    <Card key={obj.id} className="mb-4 overflow-hidden border-l-4 border-l-primary">
      <div className="bg-card/50 p-4 border-b flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={obj.level === 'company' ? 'default' : obj.level === 'department' ? 'secondary' : 'outline'}>{obj.level}</Badge>
            <span className="flex items-center gap-1 text-sm font-medium">{getStatusIcon(obj.status)} {obj.status.replace('_', ' ')}</span>
          </div>
          <h3 className="font-bold text-lg leading-tight">{obj.title}</h3>
          {obj.description && <p className="text-sm text-muted-foreground mt-1">{obj.description}</p>}
          <div className="text-xs text-muted-foreground mt-2">Owner: {obj.profiles?.first_name} {obj.profiles?.last_name}</div>
        </div>
        <div className="text-right ml-4 w-32 shrink-0">
          <div className="text-2xl font-bold text-primary">{obj.progress}%</div>
          <Progress value={obj.progress} className="h-2 mt-2" />
        </div>
      </div>
      <div className="bg-muted/30 p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-1"><Key className="h-4 w-4 text-muted-foreground" /> Key Results</h4>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openNewKr(obj.id)}><Plus className="h-3 w-3 mr-1" /> Add KR</Button>
        </div>
        <div className="space-y-3">
          {obj.okr_key_results?.length === 0 ? <p className="text-xs text-muted-foreground italic">No key results yet.</p> : null}
          {obj.okr_key_results?.map((kr: any) => {
            const krProgress = Math.min(100, Math.round((kr.current_value / kr.target_value) * 100));
            return (
              <div key={kr.id} className="bg-background border rounded p-3 flex justify-between items-center group">
                <div className="flex-1 mr-4">
                  <p className="text-sm font-medium">{kr.title}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="text-xs font-semibold">{kr.current_value} / {kr.target_value} {kr.unit}</div>
                    <Progress value={krProgress} className="h-1.5 flex-1 max-w-[200px]" />
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openCheckIn(obj.id, kr)}>
                  <TrendingUp className="h-3 w-3 mr-1" /> Update
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );

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
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
            <TabsTrigger value="all" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 px-6">All OKRs</TabsTrigger>
            <TabsTrigger value="company" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 px-6">Company Level</TabsTrigger>
            <TabsTrigger value="department" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 px-6">Department Level</TabsTrigger>
            <TabsTrigger value="individual" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 px-6">Individual</TabsTrigger>
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
                  <SelectContent>{team.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
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
