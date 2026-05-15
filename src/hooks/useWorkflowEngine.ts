import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TRIGGER_TYPES } from '@/config/workflowConfig';

interface Workflow {
  id: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  action_type: string;
  action_config: Record<string, unknown>;
  step_order: number;
}

function checkCondition(value: unknown, operator: string, target: unknown): boolean {
  const v = String(value || '').toLowerCase();
  const t = String(target || '').toLowerCase();
  switch (operator) {
    case 'equals': return v === t;
    case 'not_equals': return v !== t;
    case 'contains': return v.includes(t);
    case 'greater_than': return Number(value) > Number(target);
    case 'less_than': return Number(value) < Number(target);
    default: return true;
  }
}

function matchesTrigger(workflow: Workflow, triggerType: string, payload: Record<string, unknown>): boolean {
  if (workflow.trigger_type !== triggerType) return false;
  if (!workflow.is_active) return false;

  const config = workflow.trigger_config;
  if (config.conditions && Array.isArray(config.conditions)) {
    for (const cond of config.conditions as { field: string; operator: string; value: string }[]) {
      if (!checkCondition(payload[cond.field], cond.operator, cond.value)) return false;
    }
  }
  return true;
}

async function executeStep(step: WorkflowStep, payload: Record<string, unknown>, userId: string | undefined) {
  const config = step.action_config;

  switch (step.action_type) {
    case 'send_notification':
      toast.info(String(config.title || 'Workflow'), {
        description: String(config.message || '').replace(/\{(\w+)\}/g, (_, k) => String(payload[k] || k)),
      });
      break;

    case 'create_note':
      await supabase.from('notes').insert({
        title: String(config.title || 'Auto Note').replace(/\{(\w+)\}/g, (_, k) => String(payload[k] || k)),
        content: String(config.content || '').replace(/\{(\w+)\}/g, (_, k) => String(payload[k] || k)),
        user_id: userId || null,
        color: '#4f46e5',
      });
      break;

    case 'update_field':
      if (config.table && config.field && config.match_field) {
        await (supabase as any)
          .from(config.table as string)
          .update({ [config.field as string]: config.value })
          .eq(config.match_field as string, payload[config.match_value as string] || payload.id);
      }
      break;

    case 'send_webhook':
      if (config.url) {
        try {
          await fetch(String(config.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trigger: payload, timestamp: new Date().toISOString() }),
          });
        } catch (e) { console.error('Webhook failed:', e); }
      }
      break;

    case 'log_activity':
      console.log(`[Workflow] ${config.message || 'Activity logged'}`, payload);
      break;
  }
}

export function useWorkflowEngine() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const workflowsRef = useRef<Workflow[]>([]);

  // Load active workflows
  useEffect(() => {
    if (!user?.id) return;

    const loadWorkflows = async () => {
      const { data: wfs } = await supabase.from('workflows').select('*').eq('is_active', true);
      if (!wfs) return;

      const ids = wfs.map(w => w.id);
      const { data: steps } = await supabase
        .from('workflow_steps')
        .select('*')
        .in('workflow_id', ids)
        .order('step_order');

      workflowsRef.current = wfs.map(w => ({
        ...w,
        trigger_config: (w.trigger_config || {}) as Record<string, unknown>,
        steps: (steps || [])
          .filter(s => s.workflow_id === w.id)
          .map(s => ({ ...s, action_config: (s.action_config || {}) as Record<string, unknown> })),
      }));
    };

    loadWorkflows();

    // Refresh workflows when they change
    const wfChannel = supabase
      .channel('workflow_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflows' }, () => loadWorkflows())
      .subscribe();

    return () => { supabase.removeChannel(wfChannel); };
  }, [user?.id]);

  // Subscribe to all trigger tables
  useEffect(() => {
    if (!user?.id) return;

    const tables = [...new Set(TRIGGER_TYPES.map(t => t.table))];
    const channels = tables.map(table => {
      return supabase
        .channel(`wf_${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, async (payload) => {
          const eventType = payload.eventType;
          const newData = (payload.new || {}) as Record<string, unknown>;
          const oldData = (payload.old || {}) as Record<string, unknown>;

          // Find matching triggers
          const matchingTriggers = TRIGGER_TYPES.filter(t => t.table === table && t.event === eventType);

          for (const trigger of matchingTriggers) {
            // Special checks for "changed" triggers
            if (trigger.value === 'lead_status_changed' && oldData.status === newData.status) continue;
            if (trigger.value === 'project_stage_changed' && oldData.stage === newData.stage) continue;
            if (trigger.value === 'project_completed' && newData.status !== 'completed') continue;
            if (trigger.value === 'asset_assigned' && !newData.assigned_to) continue;

            // Find matching workflows
            const matched = workflowsRef.current.filter(w => matchesTrigger(w, trigger.value, newData));

            for (const workflow of matched) {
              // Log execution start
              const { data: exec } = await supabase.from('workflow_executions').insert({
                workflow_id: workflow.id,
                trigger_data: newData as unknown as Record<string, never>,
                status: 'running',
              }).select().single();

              try {
                // Execute steps in order
                for (let i = 0; i < workflow.steps.length; i++) {
                  await executeStep(workflow.steps[i], newData, user?.id);
                  if (exec) {
                    await supabase.from('workflow_executions')
                      .update({ steps_completed: i + 1 })
                      .eq('id', exec.id);
                  }
                }
                // Mark success
                if (exec) {
                  await supabase.from('workflow_executions')
                    .update({ status: 'completed', completed_at: new Date().toISOString() })
                    .eq('id', exec.id);
                }
              } catch (err) {
                if (exec) {
                  await supabase.from('workflow_executions')
                    .update({ status: 'failed', error: String(err), completed_at: new Date().toISOString() })
                    .eq('id', exec.id);
                }
              }
              qc.invalidateQueries({ queryKey: ['workflow-executions'] });
            }
          }
        })
        .subscribe();
    });

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [user?.id, qc]);
}
