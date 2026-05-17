import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Zap, Plus, MoreVertical, Edit, Trash2, Loader2, Play, Pause, History, CheckCircle2, XCircle, Clock, X } from 'lucide-react';
import { TRIGGER_TYPES, ACTION_TYPES, TRIGGER_FIELDS, CONDITION_OPERATORS } from '@/config/workflowConfig';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Condition { field: string; operator: string; value: string; }
interface StepForm { action_type: string; action_config: Record<string, string>; }

export default function Workflows() {
  const { role, user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [steps, setSteps] = useState<StepForm[]>([]);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workflows').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allSteps = [] } = useQuery({
    queryKey: ['workflow-steps'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workflow_steps').select('*').order('step_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: executions = [] } = useQuery({
    queryKey: ['workflow-executions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workflow_executions').select('*').order('started_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const wfData = {
        name, description, trigger_type: triggerType,
        trigger_config: { conditions } as any,
        is_active: true, created_by: user?.id || null,
      };

      let wfId = editId;
      if (editId) {
        const { error } = await supabase.from('workflows').update(wfData).eq('id', editId);
        if (error) throw error;
        await supabase.from('workflow_steps').delete().eq('workflow_id', editId);
      } else {
        const { data, error } = await supabase.from('workflows').insert(wfData).select().single();
        if (error) throw error;
        wfId = data.id;
      }

      if (steps.length > 0 && wfId) {
        const { error } = await supabase.from('workflow_steps').insert(
          steps.map((s, i) => ({
            workflow_id: wfId!, step_order: i + 1,
            action_type: s.action_type, action_config: s.action_config as any,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow-steps'] });
      toast.success(editId ? 'Workflow updated' : 'Workflow created');
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('workflows').update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workflows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Deleted'); setDeleteId(null); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditId(null); setName(''); setDescription(''); setTriggerType(''); setConditions([]); setSteps([]); };

  const openEdit = (wf: typeof workflows[0]) => {
    setEditId(wf.id);
    setName(wf.name);
    setDescription(wf.description || '');
    setTriggerType(wf.trigger_type);
    const cfg = (wf.trigger_config || {}) as Record<string, unknown>;
    setConditions((cfg.conditions as Condition[]) || []);
    const wfSteps = allSteps.filter(s => s.workflow_id === wf.id);
    setSteps(wfSteps.map(s => ({ action_type: s.action_type, action_config: (s.action_config || {}) as Record<string, string> })));
    setDialogOpen(true);
  };

  const addCondition = () => setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, key: keyof Condition, val: string) => {
    const c = [...conditions]; c[i] = { ...c[i], [key]: val }; setConditions(c);
  };

  const addStep = () => setSteps([...steps, { action_type: 'send_notification', action_config: {} }]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i: number, key: string, val: string) => {
    const s = [...steps]; 
    if (key === 'action_type') { s[i] = { action_type: val, action_config: {} }; }
    else { s[i] = { ...s[i], action_config: { ...s[i].action_config, [key]: val } }; }
    setSteps(s);
  };

  const triggerLabel = (t: string) => TRIGGER_TYPES.find(x => x.value === t)?.label || t;
  const actionLabel = (a: string) => ACTION_TYPES.find(x => x.value === a)?.label || a;
  const actionIcon = (a: string) => ACTION_TYPES.find(x => x.value === a)?.icon || '⚡';
  const availableFields = TRIGGER_FIELDS[triggerType] || [];

  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.is_active).length,
    executed: executions.length,
    failed: executions.filter(e => e.status === 'failed').length,
  };

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Workflow Automation</h1>
            <p className="text-muted-foreground mt-1">Automate actions when events happen</p>
          </div>
          {role === 'admin' && (
            <Button className="gradient-primary" onClick={() => { closeDialog(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />New Workflow
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total Workflows', value: stats.total, icon: Zap, color: 'text-primary' },
            { label: 'Active', value: stats.active, icon: Play, color: 'text-green-500' },
            { label: 'Executions', value: stats.executed, icon: CheckCircle2, color: 'text-blue-500' },
            { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-red-500' },
          ].map((s, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm text-muted-foreground">{s.label}</p><div className="text-2xl font-bold">{s.value}</div></div>
                  <s.icon className={`h-8 w-8 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="workflows">
          <TabsList><TabsTrigger value="workflows">Workflows</TabsTrigger><TabsTrigger value="history">Execution History</TabsTrigger></TabsList>

          <TabsContent value="workflows" className="space-y-3 mt-4">
            {workflows.map(wf => {
              const wfSteps = allSteps.filter(s => s.workflow_id === wf.id);
              return (
                <Card key={wf.id} className="glass-card">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10"><Zap className="h-6 w-6 text-primary" /></div>
                        <div>
                          <p className="font-medium">{wf.name}</p>
                          <p className="text-sm text-muted-foreground">Trigger: {triggerLabel(wf.trigger_type)}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {wfSteps.map((s, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{actionIcon(s.action_type)} {actionLabel(s.action_type)}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={wf.is_active} onCheckedChange={v => toggleMutation.mutate({ id: wf.id, active: v })} />
                        <Badge className={wf.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{wf.is_active ? 'Active' : 'Paused'}</Badge>
                        {role === 'admin' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(wf)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteId(wf.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {workflows.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" /><p>No workflows yet. Create one to automate your work!</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {executions.map(ex => {
              const wf = workflows.find(w => w.id === ex.workflow_id);
              return (
                <div key={ex.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    {ex.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : ex.status === 'failed' ? <XCircle className="h-5 w-5 text-red-500" /> : <Clock className="h-5 w-5 text-yellow-500 animate-spin" />}
                    <div>
                      <p className="font-medium text-sm">{wf?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(ex.started_at), 'MMM d, yyyy h:mm a')} • Steps: {ex.steps_completed}</p>
                      {ex.error && <p className="text-xs text-red-500 mt-0.5">{ex.error}</p>}
                    </div>
                  </div>
                  <Badge className={ex.status === 'completed' ? 'bg-green-100 text-green-800' : ex.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>{ex.status}</Badge>
                </div>
              );
            })}
            {executions.length === 0 && <div className="text-center py-12 text-muted-foreground"><History className="h-12 w-12 mx-auto mb-3 opacity-20" /><p>No executions yet</p></div>}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit' : 'Create'} Workflow</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Workflow Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome new lead" /></div>
              <div><Label>Trigger *</Label>
                <Select value={triggerType} onValueChange={v => { setTriggerType(v); setConditions([]); }}>
                  <SelectTrigger><SelectValue placeholder="Select trigger" /></SelectTrigger>
                  <SelectContent>{TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What does this workflow do?" /></div>

            {/* Conditions */}
            {triggerType && availableFields.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Conditions (optional)</Label><Button variant="outline" size="sm" onClick={addCondition}><Plus className="h-3 w-3 mr-1" />Add</Button></div>
                {conditions.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select value={c.field} onValueChange={v => updateCondition(i, 'field', v)}>
                      <SelectTrigger className="w-[140px]"><SelectValue placeholder="Field" /></SelectTrigger>
                      <SelectContent>{availableFields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={c.operator} onValueChange={v => updateCondition(i, 'operator', v)}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{CONDITION_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)} placeholder="Value" className="flex-1" />
                    <Button variant="ghost" size="icon" onClick={() => removeCondition(i)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}

            {/* Action Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Actions *</Label><Button variant="outline" size="sm" onClick={addStep}><Plus className="h-3 w-3 mr-1" />Add Action</Button></div>
              {steps.map((s, i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">Step {i + 1}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStep(i)}><X className="h-3 w-3" /></Button>
                  </div>
                  <Select value={s.action_type} onValueChange={v => updateStep(i, 'action_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.icon} {a.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="mt-2 space-y-2">
                    {s.action_type === 'send_notification' && (
                      <>
                        <Input value={s.action_config.title || ''} onChange={e => updateStep(i, 'title', e.target.value)} placeholder="Notification title" />
                        <Input value={s.action_config.message || ''} onChange={e => updateStep(i, 'message', e.target.value)} placeholder="Message (use {field_name} for dynamic values)" />
                      </>
                    )}
                    {s.action_type === 'create_note' && (
                      <>
                        <Input value={s.action_config.title || ''} onChange={e => updateStep(i, 'title', e.target.value)} placeholder="Note title" />
                        <Textarea value={s.action_config.content || ''} onChange={e => updateStep(i, 'content', e.target.value)} placeholder="Note content (use {field_name})" rows={2} />
                      </>
                    )}
                    {s.action_type === 'update_field' && (
                      <>
                        <Input value={s.action_config.table || ''} onChange={e => updateStep(i, 'table', e.target.value)} placeholder="Table name (e.g. leads)" />
                        <Input value={s.action_config.field || ''} onChange={e => updateStep(i, 'field', e.target.value)} placeholder="Field to update" />
                        <Input value={s.action_config.value || ''} onChange={e => updateStep(i, 'value', e.target.value)} placeholder="New value" />
                        <Input value={s.action_config.match_field || ''} onChange={e => updateStep(i, 'match_field', e.target.value)} placeholder="Match field (e.g. id)" />
                        <Input value={s.action_config.match_value || ''} onChange={e => updateStep(i, 'match_value', e.target.value)} placeholder="Match from trigger (e.g. id)" />
                      </>
                    )}
                    {s.action_type === 'send_webhook' && (
                      <Input value={s.action_config.url || ''} onChange={e => updateStep(i, 'url', e.target.value)} placeholder="https://your-webhook-url.com" />
                    )}
                    {s.action_type === 'log_activity' && (
                      <Input value={s.action_config.message || ''} onChange={e => updateStep(i, 'message', e.target.value)} placeholder="Log message" />
                    )}
                  </div>
                </Card>
              ))}
              {steps.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Add at least one action step</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name || !triggerType || steps.length === 0}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Workflow</AlertDialogTitle><AlertDialogDescription>This will permanently delete this workflow and all its steps.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
