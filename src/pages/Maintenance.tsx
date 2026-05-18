/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';
import { format, isBefore, addMonths, addYears, isValid, parseISO } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  History,
  Plus,
  ServerOff,
  ShieldCheck,
  Zap,
  MoreVertical,
  FileText,
  Trash2,
  Edit,
  Eye
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNotifications } from '@/hooks/useNotifications';

// --- TYPES ---
type MaintenanceFrequency = 'monthly' | 'quarterly' | 'yearly';
type MaintenanceStatus = 'active' | 'pending_payment' | 'overdue' | 'cancelled';

interface Contract {
  id: string;
  client_name: string;
  service_tier: string;
  frequency: MaintenanceFrequency;
  amount: number;
  next_billing_date: string;
  status: MaintenanceStatus;
  project_id?: string;
  active_projects?: {
    project_name: string;
  };
}

// --- HELPER ---
const safeFormatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  const date = parseISO(dateString);
  return isValid(date) ? format(date, 'MMM dd, yyyy') : 'Invalid Date';
};

export default function Maintenance() {
  const queryClient = useQueryClient();
  
  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [logWorkOpen, setLogWorkOpen] = useState(false);
  const [viewLogsOpen, setViewLogsOpen] = useState(false);
  const [globalAuditOpen, setGlobalAuditOpen] = useState(false);
  const [suspendedOpen, setSuspendedOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Selection State
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  
  // Forms
  const [logForm, setLogForm] = useState({ title: '', description: '' });

  // --- 1. FETCH CONTRACTS ---
  const { data: contracts = [] } = useQuery({
    queryKey: ['maintenance'],
    queryFn: async () => {
      // NOTE: Using 'as any' to bypass TS error until types are regenerated
      const { data, error } = await supabase
        .from('maintenance_contracts' as any)
        .select(`*, active_projects(project_name)`)
        .order('next_billing_date', { ascending: true });
      
      if (error) throw error;
      return (data || []) as unknown as Contract[];
    },
  });

  // --- 2. FETCH LOGS (Specific or Global) ---
  const { data: logs = [] } = useQuery({
    queryKey: ['maintenance_logs', selectedContract?.id, globalAuditOpen],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_logs' as any)
        .select(`*, maintenance_contracts(client_name)`)
        .order('performed_at', { ascending: false });

      // If viewing specific contract logs, filter by ID
      if (viewLogsOpen && selectedContract) {
        query = query.eq('contract_id', selectedContract.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: viewLogsOpen || globalAuditOpen
  });

  // --- 3. FETCH PROJECTS ---
  const { data: projects = [] } = useQuery({
    queryKey: ['completed_projects_list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('active_projects')
        .select('id, project_name, client_name')
        .eq('status', 'completed'); 
      return data || [];
    }
  });

  // --- MUTATIONS ---

  // Add New Contract
  const addContractMutation = useMutation({
    mutationFn: async (formData: any) => {
      const payload = {
        ...formData,
        project_id: formData.project_id === "none" || !formData.project_id ? null : formData.project_id
      };
      const { error } = await supabase.from('maintenance_contracts' as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      setIsAddOpen(false);
      toast.success("Contract created successfully");
    },
    onError: (err) => toast.error(err.message)
  });

  // Update Contract
  const updateContractMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { error } = await supabase
        .from('maintenance_contracts' as any)
        .update(formData)
        .eq('id', selectedContract?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      setIsEditOpen(false);
      toast.success("Contract updated");
    },
    onError: (err) => toast.error(err.message)
  });

  // Delete Contract
  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_contracts' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      setDeleteId(null);
      toast.success("Contract deleted");
    }
  });

  // Log Work
  const addLogMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContract) return;
      const { error } = await supabase.from('maintenance_logs' as any).insert({
        contract_id: selectedContract.id,
        title: logForm.title,
        description: logForm.description,
        performed_at: new Date().toISOString()
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setLogWorkOpen(false);
      setLogForm({ title: '', description: '' });
      toast.success("Work logged successfully");
    },
    onError: (err) => toast.error("Failed to log work: " + err.message)
  });

  // Record Payment & Sync with Finances
  const paymentMutation = useMutation({
    mutationFn: async (contract: Contract) => {
      // 1. Calculate New Date
      let newDate = parseISO(contract.next_billing_date);
      if (!isValid(newDate)) newDate = new Date();
      if (contract.frequency === 'monthly') newDate = addMonths(newDate, 1);
      else if (contract.frequency === 'yearly') newDate = addYears(newDate, 1);
      else newDate = addMonths(newDate, 3);

      // 2. Update Contract Date & Status
      const { error: updateError } = await supabase
        .from('maintenance_contracts' as any)
        .update({ status: 'active', next_billing_date: format(newDate, 'yyyy-MM-dd') })
        .eq('id', contract.id);
      if (updateError) throw updateError;

      // 3. INSERT INTO INVOICES (Sync with Finance)
      // NOTE: Ensure your 'invoices' table has these columns. 
      const { error: invoiceError } = await supabase.from('invoices').insert({
        invoice_number: `MAINT-${contract.id.slice(0, 8).toUpperCase()}`,
        client_name: contract.client_name,
        contract_id: contract.id,
        project_id: contract.project_id || null,
        total_amount: Number(contract.amount),
        paid_amount: Number(contract.amount),
        status: 'paid', // Automatically marked as paid
        due_date: new Date().toISOString(),
        issue_date: new Date().toISOString(),
        notes: `Maintenance Fee (${contract.service_tier}) - ${contract.frequency} for ${contract.client_name}`
      });

      if (invoiceError) {
         console.error("Finance Sync Error:", invoiceError); 
         // We don't throw here to ensure the maintenance update sticks even if finance fails
         toast.warning("Payment recorded, but failed to sync to Finance dashboard.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      toast.success("Payment recorded & synced to Finances!");
    },
    onError: (err) => toast.error(err.message)
  });

  // --- STATS ---
  const totalMRR = contracts
    .filter(c => c.status === 'active' && c.frequency === 'monthly')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  
  const totalARR = contracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => {
      if(c.frequency === 'monthly') return sum + (Number(c.amount) * 12);
      if(c.frequency === 'quarterly') return sum + (Number(c.amount) * 4);
      return sum + Number(c.amount);
    }, 0);

  const activeCount = contracts.filter(c => c.status === 'active').length;
  
  const overdueContracts = contracts.filter(c => {
    const d = parseISO(c.next_billing_date);
    return isValid(d) && isBefore(d, new Date());
  });
  const overdueCount = overdueContracts.length;

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-10">
        {/* --- HEADER --- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-2.5 tracking-tight text-slate-800 dark:text-slate-100">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              Maintenance Hub
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">Manage recurring revenue, updates, and client subscriptions securely.</p>
          </div>
          <Button className="gradient-primary shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 rounded-xl h-10 px-5 text-sm font-semibold transition-all duration-200" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </div>

        {/* --- STATS ROW --- */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden bg-emerald-500/5 dark:bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 rounded-2xl hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm p-4 col-span-1">
            <CardContent className="p-0 flex items-center justify-between">
              <div className="space-y-1 truncate">
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider truncate">Monthly Revenue (MRR)</p>
                <div className="text-xl md:text-2xl font-extrabold text-emerald-900 dark:text-emerald-100">{formatCurrency(totalMRR)}</div>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 shrink-0 ml-2">
                <Activity className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 hover:border-primary/25 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm p-4 col-span-1">
            <CardContent className="p-0 flex items-center justify-between">
              <div className="space-y-1 truncate">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Projected Annual (ARR)</p>
                <div className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100">{formatCurrency(totalARR)}</div>
              </div>
              <div className="p-3 rounded-2xl bg-primary/10 text-primary shrink-0 ml-2">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 hover:border-primary/25 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm p-4 col-span-1">
            <CardContent className="p-0 flex items-center justify-between">
              <div className="space-y-1 truncate">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Active Clients</p>
                <div className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100">{activeCount}</div>
              </div>
              <div className="p-3 rounded-2xl bg-primary/10 text-primary shrink-0 ml-2">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className={`relative overflow-hidden bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border rounded-2xl hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm p-4 col-span-1 ${overdueCount > 0 ? 'border-rose-500/30 bg-rose-500/5' : 'border-border/40 hover:border-primary/25'}`}>
            <CardContent className="p-0 flex items-center justify-between">
              <div className="space-y-1 truncate">
                <p className={`text-xs font-semibold uppercase tracking-wider truncate ${overdueCount > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                  Overdue / Blocked
                </p>
                <div className={`text-xl md:text-2xl font-extrabold ${overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
                  {overdueCount}
                </div>
              </div>
              <div className={`p-3 rounded-2xl shrink-0 ml-2 ${overdueCount > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-500/10 text-slate-400'}`}>
                {overdueCount > 0 ? <ServerOff className="h-5 w-5 animate-pulse" /> : <ShieldCheck className="h-5 w-5" />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- MAIN CORE MODULES --- */}
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
          {/* --- ACTIVE CONTRACTS GRID --- */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">Active Contracts</h2>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none shadow-none font-bold rounded-lg">{contracts.length}</Badge>
            </div>
            
            <div className="space-y-4">
              {contracts.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed rounded-3xl border-border/40 bg-card/20 max-w-md mx-auto">
                  <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">No Contracts Setup</h3>
                  <p className="text-xs text-muted-foreground mt-1 px-4">Get started by creating a recurring billing contract for your clients.</p>
                </div>
              )}
              
              {contracts.map((contract) => {
                const date = parseISO(contract.next_billing_date);
                const isOverdue = isValid(date) && isBefore(date, new Date());
                
                return (
                  <div 
                    key={contract.id} 
                    className={`group relative bg-card/65 dark:bg-slate-900/65 backdrop-blur-sm border rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300 shadow-sm hover:shadow-md hover:border-primary/20 ${isOverdue ? 'border-rose-500/25 bg-rose-500/5' : 'border-border/40'}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-2xl shrink-0 mt-0.5 ${isOverdue ? 'bg-rose-500/10 text-rose-500' : 'bg-primary/10 text-primary'}`}>
                        {isOverdue ? <ServerOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                      </div>
                      
                      <div className="space-y-1 truncate">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-2 text-base">
                          {contract.client_name}
                          {contract.active_projects?.project_name && (
                            <Badge variant="outline" className="text-[10px] h-5 bg-muted/60 dark:bg-slate-800 border-border/50 text-slate-600 dark:text-slate-300 font-semibold px-2">
                              {contract.active_projects.project_name}
                            </Badge>
                          )}
                        </h4>
                        
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{contract.service_tier}</span> Plan
                          <span>•</span>
                          <span className="uppercase text-[10px] tracking-wide font-extrabold px-1.5 py-0.5 rounded bg-muted dark:bg-slate-800">{contract.frequency}</span>
                        </p>
                        
                        <div className="flex gap-2 pt-1">
                          <Badge className={`border uppercase text-[9px] font-extrabold tracking-wider px-2 py-0.5 shadow-none ${isOverdue ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}`}>
                            {isOverdue ? 'Service Blocked' : 'Active'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-border/30">
                      <div className="text-left sm:text-right">
                        <div className="font-extrabold text-lg text-slate-800 dark:text-slate-100">{formatCurrency(contract.amount)}</div>
                        <p className={`text-xs ${isOverdue ? 'text-rose-500 font-extrabold' : 'text-muted-foreground font-medium'}`}>
                          Due: {safeFormatDate(contract.next_billing_date)}
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted shrink-0 border border-border/10">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl shadow-lg border border-border/40">
                          <DropdownMenuLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-border/40" />
                          
                          {/* Payment Action */}
                          {isOverdue ? (
                            <DropdownMenuItem className="rounded-lg text-rose-600 focus:bg-rose-50 focus:text-rose-700 cursor-pointer font-semibold" onClick={() => paymentMutation.mutate(contract)}>
                              <DollarSign className="h-4 w-4 mr-2 text-rose-500" /> Record Payment
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => { setSelectedContract(contract); setLogForm({ title: '', description: '' }); setLogWorkOpen(true); }}>
                              <FileText className="h-4 w-4 mr-2 text-muted-foreground" /> Log Performed Work
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator className="bg-border/40" />

                          {/* View Logs */}
                          <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => { setSelectedContract(contract); setViewLogsOpen(true); }}>
                            <Eye className="h-4 w-4 mr-2 text-muted-foreground" /> View Audit Logs
                          </DropdownMenuItem>

                          {/* Edit Details */}
                          <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => { setSelectedContract(contract); setIsEditOpen(true); }}>
                            <Edit className="h-4 w-4 mr-2 text-muted-foreground" /> Edit Settings
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="bg-border/40" />

                          {/* Cancel/Delete */}
                          <DropdownMenuItem className="rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer font-medium" onClick={() => setDeleteId(contract.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Cancel Contract
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* --- RIGHT SIDEBAR - CHARTS & AUDIT LINKS --- */}
          <div className="space-y-6">
            <Card className="glass-card bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 rounded-2xl shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/45">
                <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Income Flow Split</CardTitle>
                <CardDescription className="text-xs">Visual breakdown normalized to monthly cashflow.</CardDescription>
              </CardHeader>
              <CardContent className="h-[230px] pt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Monthly', value: totalMRR },
                    { name: 'Quarterly', value: contracts.filter(c => c.frequency === 'quarterly').reduce((s, c) => s + Number(c.amount), 0) / 3 },
                    { name: 'Yearly', value: contracts.filter(c => c.frequency === 'yearly').reduce((s, c) => s + Number(c.amount), 0) / 12 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" fontSize={11} stroke="rgba(156, 163, 175, 0.8)" />
                    <YAxis fontSize={11} stroke="rgba(156, 163, 175, 0.8)" />
                    <Tooltip 
                      contentStyle={{ background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(0, 0, 0, 0.05)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#1f2937' }}
                      formatter={(value: number) => [formatCurrency(value), 'Monthly Value']}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card bg-primary/5 dark:bg-slate-900/40 border border-primary/20 dark:border-border/60 rounded-2xl p-5 shadow-inner">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-200">Management & Alerts</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3">
                <Button variant="outline" className="w-full justify-start rounded-xl h-11 bg-card/50 hover:bg-card border-border/50 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm" onClick={() => setGlobalAuditOpen(true)}>
                  <History className="h-4 w-4 mr-2.5 text-primary" /> View Global Audit Logs
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-xl h-11 border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-bold text-rose-600 dark:text-rose-400 shadow-sm" onClick={() => setSuspendedOpen(true)}>
                  <AlertTriangle className="h-4 w-4 mr-2.5" /> Suspended Accounts ({overdueCount})
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* --- DIALOGS SECTION --- */}

        {/* 1. Add Contract Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-lg rounded-2xl border-border/40 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">New Maintenance Contract</DialogTitle>
              <DialogDescription>Link a completed project to a recurring maintenance plan.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e: any) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              addContractMutation.mutate({
                client_name: formData.get('client_name'),
                project_id: formData.get('project_id'),
                service_tier: formData.get('service_tier'),
                frequency: formData.get('frequency'),
                amount: formData.get('amount'),
                next_billing_date: formData.get('next_billing_date'),
                status: 'active'
              });
            }} className="space-y-4 py-4 pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client Name *</Label>
                  <Input name="client_name" className="rounded-xl border-border/60" required placeholder="Business Name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project Link</Label>
                  <Select name="project_id">
                    <SelectTrigger className="rounded-xl border-border/60"><SelectValue placeholder="Select Project" /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/40">
                      <SelectItem value="none">-- No Project --</SelectItem>
                      {projects?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Service Tier</Label>
                  <Select name="service_tier" defaultValue="Standard">
                    <SelectTrigger className="rounded-xl border-border/60"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/40">
                      <SelectItem value="Basic">Basic</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Frequency</Label>
                  <Select name="frequency" defaultValue="monthly">
                    <SelectTrigger className="rounded-xl border-border/60"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/40">
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recurring Amount ($) *</Label>
                  <Input name="amount" type="number" className="rounded-xl border-border/60" required placeholder="5000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Next Billing Date *</Label>
                  <Input name="next_billing_date" type="date" className="rounded-xl border-border/60" required />
                </div>
              </div>
              
              <DialogFooter className="pt-3 gap-2">
                <Button type="button" variant="outline" className="rounded-xl border-border/60" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" className="gradient-primary rounded-xl" disabled={addContractMutation.isPending}>
                  {addContractMutation.isPending ? 'Saving...' : 'Create Contract'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 2. Edit Contract Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg rounded-2xl border-border/40 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Edit Contract Settings</DialogTitle>
              <DialogDescription>Modify parameters for this recurring plan.</DialogDescription>
            </DialogHeader>
            {selectedContract && (
              <form onSubmit={(e: any) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                updateContractMutation.mutate({
                  client_name: formData.get('client_name'),
                  amount: formData.get('amount'),
                  service_tier: formData.get('service_tier'),
                  next_billing_date: formData.get('next_billing_date'),
                });
              }} className="space-y-4 py-4 pr-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client Name</Label>
                  <Input name="client_name" className="rounded-xl border-border/60" defaultValue={selectedContract.client_name} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Billing Amount ($)</Label>
                    <Input name="amount" type="number" className="rounded-xl border-border/60" defaultValue={selectedContract.amount} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Service Tier Plan</Label>
                    <Input name="service_tier" className="rounded-xl border-border/60" defaultValue={selectedContract.service_tier} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Next Billing Date</Label>
                  <Input name="next_billing_date" type="date" className="rounded-xl border-border/60" defaultValue={selectedContract.next_billing_date} />
                </div>
                <DialogFooter className="pt-3 gap-2">
                  <Button type="button" variant="outline" className="rounded-xl border-border/60" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                  <Button type="submit" className="gradient-primary rounded-xl" disabled={updateContractMutation.isPending}>
                    {updateContractMutation.isPending ? 'Updating...' : 'Save Settings'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* 3. Log Work Dialog */}
        <Dialog open={logWorkOpen} onOpenChange={setLogWorkOpen}>
          <DialogContent className="max-w-md rounded-2xl border-border/40 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Log Maintenance Work</DialogTitle>
              <DialogDescription>Document server patches, core updates, or backups completed for {selectedContract?.client_name}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 pr-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Task Title *</Label>
                <Input value={logForm.title} className="rounded-xl border-border/60" placeholder="E.g. Security updates, core backups" onChange={e => setLogForm({...logForm, title: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Work Details *</Label>
                <Input value={logForm.description} className="rounded-xl border-border/60" placeholder="Describe the updates or performed support items" onChange={e => setLogForm({...logForm, description: e.target.value})} />
              </div>
              <DialogFooter className="pt-3 gap-2">
                <Button type="button" variant="outline" className="rounded-xl border-border/60" onClick={() => setLogWorkOpen(false)}>Cancel</Button>
                <Button className="gradient-primary rounded-xl" onClick={() => addLogMutation.mutate()} disabled={!logForm.title || !logForm.description || addLogMutation.isPending}>
                  {addLogMutation.isPending ? 'Saving...' : 'Save Log Entry'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* 4. Global Audit Logs Dialog */}
        <Dialog open={globalAuditOpen} onOpenChange={setGlobalAuditOpen}>
          <DialogContent className="max-w-2xl rounded-2xl border-border/40 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Global Maintenance Audit Log
              </DialogTitle>
              <DialogDescription>A complete historical archive of all recurring revenue tasks and client logs.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-center py-10 text-sm">No recorded log logs are registered at this moment.</p>
              ) : (
                logs.map((log: any) => (
                  <div key={log.id} className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-1">
                    <div className="flex justify-between items-start gap-4">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{log.title}</h4>
                      <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5 bg-card border border-border/30 rounded">{safeFormatDate(log.performed_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{log.description}</p>
                    <p className="text-[10px] text-primary font-bold mt-2">Client Account: {log.maintenance_contracts?.client_name}</p>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 5. Specific Contract Logs Dialog */}
        <Dialog open={viewLogsOpen} onOpenChange={setViewLogsOpen}>
          <DialogContent className="max-w-xl rounded-2xl border-border/40 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                History: {selectedContract?.client_name}
              </DialogTitle>
              <DialogDescription>Specific support logs and security audit updates for this client contract.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-center py-10 text-sm">No logged updates listed for this contract.</p>
              ) : (
                logs.map((log: any) => (
                  <div key={log.id} className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-1">
                    <div className="flex justify-between items-start gap-4">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{log.title}</h4>
                      <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5 bg-card border border-border/30 rounded">{safeFormatDate(log.performed_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{log.description}</p>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 6. Suspended Accounts Dialog */}
        <Dialog open={suspendedOpen} onOpenChange={setSuspendedOpen}>
          <DialogContent className="max-w-md rounded-2xl border-border/40 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Suspended / Overdue Accounts
              </DialogTitle>
              <DialogDescription>The following accounts have unpaid dues and outstanding billing balances.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
              {overdueContracts.length === 0 ? (
                <div className="text-center py-8 text-emerald-600 flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  <p className="text-sm font-bold">Awesome! All accounts are currently in good standing!</p>
                </div>
              ) : (
                overdueContracts.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-4 bg-rose-500/5 rounded-2xl border border-rose-500/20">
                    <div className="truncate pr-2">
                      <p className="font-bold text-rose-700 dark:text-rose-400 text-sm truncate">{c.client_name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Overdue since: {safeFormatDate(c.next_billing_date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{formatCurrency(c.amount)}</p>
                      <Button size="sm" variant="destructive" className="h-7 text-xs font-bold rounded-lg mt-1 px-3 shadow-sm bg-rose-600 hover:bg-rose-700" onClick={() => paymentMutation.mutate(c)}>
                        Pay & Activate
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 7. Delete / Cancellation Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="rounded-2xl border-border/40 shadow-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Cancel & Archive Contract?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you absolutely sure you want to delete this maintenance contract? Doing so will permanently void the recurring revenue cycle and remove all related work audit history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-xl border-border/60">No, Keep Contract</AlertDialogCancel>
              <AlertDialogAction className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl" onClick={() => deleteId && deleteContractMutation.mutate(deleteId)}>
                Yes, Cancel Contract
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </DashboardLayout>
  );
}