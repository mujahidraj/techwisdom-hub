import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, BellRing, Mail, Smartphone, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<any>(null);

  const { data: serverPrefs, isLoading } = useQuery({
    queryKey: ['notification-prefs', user?.id],
    queryFn: async () => {
      if (!user) return null;
      let { data, error } = await supabase.from('app_notification_prefs').select('*').eq('user_id', user.id).single();
      
      // Auto-create if it doesn't exist
      if (error && error.code === 'PGRST116') {
        const { data: newData, error: insertError } = await supabase.from('app_notification_prefs')
          .insert({ user_id: user.id })
          .select().single();
        if (insertError) throw insertError;
        data = newData;
      } else if (error) {
        throw error;
      }
      return data;
    },
    enabled: !!user
  });

  useEffect(() => {
    if (serverPrefs) setPrefs(serverPrefs);
  }, [serverPrefs]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('app_notification_prefs').update(payload).eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-prefs'] });
      toast.success('Preferences saved successfully');
    },
    onError: (e: any) => toast.error(e.message)
  });

  if (isLoading || !prefs) return <DashboardLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;

  const handleToggle = (field: string) => setPrefs({ ...prefs, [field]: !prefs[field] });
  const handleModuleToggle = (module: string) => {
    const newModules = { ...prefs.module_toggles, [module]: !prefs.module_toggles[module] };
    setPrefs({ ...prefs, module_toggles: newModules });
  };

  const modules = [
    { id: 'system', label: 'System Alerts', desc: 'Platform updates, maintenance, and security alerts.' },
    { id: 'crm', label: 'CRM & Leads', desc: 'New leads, status changes, and pipeline updates.' },
    { id: 'projects', label: 'Projects', desc: 'Task assignments, milestones, and project completions.' },
    { id: 'hr', label: 'Human Resources', desc: 'New candidates, interview schedules, and team updates.' },
    { id: 'okr', label: 'OKRs & Goals', desc: 'Goal check-ins, progress updates, and quarter closeouts.' },
    { id: 'proposals', label: 'Proposals', desc: 'Sent quotes, accepted proposals, and client feedback.' },
    { id: 'finance', label: 'Finance', desc: 'Invoice payments, expense approvals, and financial reports.' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><BellRing className="h-8 w-8 text-primary" /> Notification Center</h1>
          <p className="text-muted-foreground mt-1">Manage how and when you receive alerts from the platform.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Delivery Methods</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Email Digest</Label>
                    <p className="text-xs text-muted-foreground">Receive a daily summary of notifications.</p>
                  </div>
                  <Switch checked={prefs.email_daily_digest} onCheckedChange={() => handleToggle('email_daily_digest')} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Push Notifications</Label>
                    <p className="text-xs text-muted-foreground">Real-time alerts via mobile and desktop push.</p>
                  </div>
                  <Switch checked={prefs.push_enabled} onCheckedChange={() => handleToggle('push_enabled')} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Module Preferences</CardTitle>
                <CardDescription>Choose which modules can send you in-app notifications.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {modules.map((m) => (
                  <div key={m.id} className="flex items-start justify-between border-b last:border-0 pb-4 last:pb-0">
                    <div className="space-y-1">
                      <Label className="text-base font-semibold">{m.label}</Label>
                      <p className="text-sm text-muted-foreground">{m.desc}</p>
                    </div>
                    <Switch 
                      checked={prefs.module_toggles[m.id] !== false} 
                      onCheckedChange={() => handleModuleToggle(m.id)} 
                      disabled={m.id === 'system'} // Never disable system alerts
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="mt-6 flex justify-end">
              <Button className="gradient-primary px-8" onClick={() => saveMutation.mutate(prefs)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Preferences
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
