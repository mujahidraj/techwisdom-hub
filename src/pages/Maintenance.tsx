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
        amount: contract.amount,
        status: 'paid', // Automatically marked as paid
        due_date: new Date().toISOString(),
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
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-8 w-8 text-primary" />
              Maintenance Hub
            </h1>
            <p className="text-muted-foreground">Manage recurring revenue, updates, and client subscriptions.</p>
          </div>
          <Button className="gradient-primary" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </div>

        {/* --- STATS ROW --- */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card bg-gradient-to-br from-green-50 to-emerald-50 border-emerald-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600">Monthly Revenue (MRR)</p>
                  <div className="text-2xl font-bold text-emerald-900">{formatCurrency(totalMRR)}</div>
                </div>
                <Activity className="h-8 w-8 text-emerald-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
             <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Projected Annual (ARR)</p>
                  <div className="text-2xl font-bold">{formatCurrency(totalARR)}</div>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                  <div className="text-2xl font-bold">{activeCount}</div>
                </div>
                <CheckCircle2 className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className={`glass-card ${overdueCount > 0 ? 'border-red-200 bg-red-50' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${overdueCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    Overdue / Blocked
                  </p>
                  <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-700' : ''}`}>
                    {overdueCount}
                  </div>
                </div>
                {overdueCount > 0 ? (
                  <ServerOff className="h-8 w-8 text-red-500" />
                ) : (
                  <ShieldCheck className="h-8 w-8 text-gray-400" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* --- MAIN LIST --- */}
          <Card className="md:col-span-2 glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Contracts</CardTitle>
                <CardDescription>Clients paying for maintenance and support.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contracts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No maintenance contracts yet.</div>
                )}
                {contracts.map((contract) => {
                  const date = parseISO(contract.next_billing_date);
                  const isOverdue = isValid(date) && isBefore(date, new Date());
                  
                  return (
                    <div key={contract.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors group">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full mt-1 ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {isOverdue ? <ServerOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                        </div>
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            {contract.client_name}
                            {contract.active_projects?.project_name && (
                                <Badge variant="secondary" className="text-[10px] h-5">{contract.active_projects.project_name}</Badge>
                            )}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {contract.service_tier} Plan • {contract.frequency}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Badge className={isOverdue ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-green-100 text-green-700 hover:bg-green-100'}>
                              {isOverdue ? 'Service Blocked' : 'Active'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-bold text-lg">{formatCurrency(contract.amount)}</div>
                          <p className={`text-xs ${isOverdue ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                            Due: {safeFormatDate(contract.next_billing_date)}
                          </p>
                        </div>

                        {/* Dropdown Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            
                            {/* 1. Record Payment */}
                            {isOverdue ? (
                                <DropdownMenuItem className="text-red-600" onClick={() => paymentMutation.mutate(contract)}>
                                    <DollarSign className="h-4 w-4 mr-2" /> Record Payment
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onClick={() => { setSelectedContract(contract); setLogWorkOpen(true); }}>
                                    <FileText className="h-4 w-4 mr-2" /> Log Work
                                </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />

                            {/* 2. View History */}
                            <DropdownMenuItem onClick={() => { setSelectedContract(contract); setViewLogsOpen(true); }}>
                                <Eye className="h-4 w-4 mr-2" /> View History
                            </DropdownMenuItem>

                            {/* 3. Edit */}
                            <DropdownMenuItem onClick={() => { setSelectedContract(contract); setIsEditOpen(true); }}>
                                <Edit className="h-4 w-4 mr-2" /> Edit Details
                            </DropdownMenuItem>

                            {/* 4. Delete */}
                            <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(contract.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Cancel Contract
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* --- RIGHT SIDEBAR --- */}
          <div className="space-y-6">
             <Card className="glass-card">
               <CardHeader>
                 <CardTitle>Income Flow</CardTitle>
                 <CardDescription>Monthly vs Yearly split</CardDescription>
               </CardHeader>
               <CardContent className="h-[250px]">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={[
                     { name: 'Monthly', value: totalMRR },
                     { name: 'Quarterly', value: contracts.filter(c => c.frequency === 'quarterly').reduce((s, c) => s + Number(c.amount), 0) / 3 },
                     { name: 'Yearly', value: contracts.filter(c => c.frequency === 'yearly').reduce((s, c) => s + Number(c.amount), 0) / 12 },
                   ]}>
                     <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                     <XAxis dataKey="name" fontSize={12} />
                     <YAxis fontSize={12} />
                     <Tooltip 
                       contentStyle={{ background: 'rgba(255, 255, 255, 0.8)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       formatter={(value: number) => formatCurrency(value)}
                     />
                     <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               </CardContent>
             </Card>

             <Card className="glass-card bg-primary/5 border-primary/20">
               <CardHeader>
                 <CardTitle className="text-sm">Quick Actions</CardTitle>
               </CardHeader>
               <CardContent className="space-y-2">
                 <Button variant="outline" className="w-full justify-start" onClick={() => setGlobalAuditOpen(true)}>
                   <History className="h-4 w-4 mr-2" /> View Audit Logs
                 </Button>
                 <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setSuspendedOpen(true)}>
                   <AlertTriangle className="h-4 w-4 mr-2" /> Suspended Accounts ({overdueCount})
                 </Button>
               </CardContent>
             </Card>
          </div>
        </div>

        {/* --- DIALOGS SECTION --- */}

        {/* 1. Add Contract */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Maintenance Contract</DialogTitle>
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
            }} className="space-y-4 py-4">
               {/* Form Fields Same as before */}
               <div className="grid grid-cols-2 gap-4">
                <div><Label>Client Name</Label><Input name="client_name" required placeholder="Business Name" /></div>
                <div>
                   <Label>Project Link</Label>
                   <Select name="project_id">
                     <SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="none">-- No Project --</SelectItem>
                       {projects?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
                     </SelectContent>
                   </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Service Tier</Label>
                  <Select name="service_tier" defaultValue="Standard">
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="Basic">Basic</SelectItem>
                       <SelectItem value="Standard">Standard</SelectItem>
                       <SelectItem value="Premium">Premium</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Select name="frequency" defaultValue="monthly">
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="monthly">Monthly</SelectItem>
                       <SelectItem value="quarterly">Quarterly</SelectItem>
                       <SelectItem value="yearly">Yearly</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Amount</Label><Input name="amount" type="number" required placeholder="5000" /></div>
                <div><Label>Next Bill</Label><Input name="next_billing_date" type="date" required /></div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={addContractMutation.isPending}>{addContractMutation.isPending ? 'Saving...' : 'Create'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 2. Edit Contract */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contract</DialogTitle>
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
                }} className="space-y-4 py-4">
                    <div><Label>Client Name</Label><Input name="client_name" defaultValue={selectedContract.client_name} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Amount</Label><Input name="amount" type="number" defaultValue={selectedContract.amount} /></div>
                        <div><Label>Service Tier</Label><Input name="service_tier" defaultValue={selectedContract.service_tier} /></div>
                    </div>
                    <div><Label>Next Billing Date</Label><Input name="next_billing_date" type="date" defaultValue={selectedContract.next_billing_date} /></div>
                    <DialogFooter><Button type="submit">Update Contract</Button></DialogFooter>
                </form>
            )}
          </DialogContent>
        </Dialog>

        {/* 3. Log Work */}
        <Dialog open={logWorkOpen} onOpenChange={setLogWorkOpen}>
          <DialogContent>
             <DialogHeader><DialogTitle>Log Work</DialogTitle></DialogHeader>
             <div className="space-y-4">
                <div><Label>Work Title</Label><Input value={logForm.title} onChange={e => setLogForm({...logForm, title: e.target.value})} /></div>
                <div><Label>Description</Label><Input value={logForm.description} onChange={e => setLogForm({...logForm, description: e.target.value})} /></div>
                <Button className="w-full gradient-primary" onClick={() => addLogMutation.mutate()}>Save Log</Button>
             </div>
          </DialogContent>
        </Dialog>

        {/* 4. Global Audit Logs */}
        <Dialog open={globalAuditOpen} onOpenChange={setGlobalAuditOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Global Maintenance Audit</DialogTitle></DialogHeader>
            <div className="space-y-4">
                {logs.length === 0 ? <p className="text-muted-foreground text-center">No logs found.</p> : logs.map((log: any) => (
                    <div key={log.id} className="border-b pb-2">
                        <div className="flex justify-between">
                            <h4 className="font-semibold">{log.title}</h4>
                            <span className="text-xs text-muted-foreground">{safeFormatDate(log.performed_at)}</span>
                        </div>
                        <p className="text-sm text-gray-600">{log.description}</p>
                        <p className="text-xs text-blue-600 mt-1">Client: {log.maintenance_contracts?.client_name}</p>
                    </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* 5. Specific Contract Logs */}
        <Dialog open={viewLogsOpen} onOpenChange={setViewLogsOpen}>
          <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>History: {selectedContract?.client_name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
                {logs.length === 0 ? <p className="text-muted-foreground text-center">No logs for this client.</p> : logs.map((log: any) => (
                    <div key={log.id} className="border-b pb-2">
                        <div className="flex justify-between">
                            <h4 className="font-semibold">{log.title}</h4>
                            <span className="text-xs text-muted-foreground">{safeFormatDate(log.performed_at)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{log.description}</p>
                    </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* 6. Suspended Accounts */}
        <Dialog open={suspendedOpen} onOpenChange={setSuspendedOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Suspended / Overdue Accounts</DialogTitle></DialogHeader>
            <div className="space-y-2">
                {overdueContracts.length === 0 ? <p className="text-green-600">All accounts are in good standing!</p> : overdueContracts.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-3 bg-red-50 rounded border border-red-100">
                        <div>
                            <p className="font-bold text-red-700">{c.client_name}</p>
                            <p className="text-xs text-red-500">Due: {safeFormatDate(c.next_billing_date)}</p>
                        </div>
                        <div className="text-right">
                             <p className="font-bold">{formatCurrency(c.amount)}</p>
                             <Button size="sm" variant="destructive" className="h-7 text-xs mt-1" onClick={() => paymentMutation.mutate(c)}>Pay Now</Button>
                        </div>
                    </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* 7. Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete this maintenance contract and all its logs.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600" onClick={() => deleteId && deleteContractMutation.mutate(deleteId)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </div>
    </DashboardLayout>
  );
}