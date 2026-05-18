import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useActivityLog } from '@/hooks/useActivityLog';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package, Plus, Search, MoreVertical, Edit, Trash2,
  Loader2, Monitor, Laptop, Smartphone, HardDrive, Printer,
  UserCheck, UserX, History, AlertTriangle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';

type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'retired' | 'lost';
type AssetCondition = 'new' | 'good' | 'fair' | 'poor' | 'damaged';

interface Asset {
  id: string;
  asset_name: string;
  asset_tag: string;
  category: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_price: number;
  warranty_expiry: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  location: string | null;
  notes: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AssetHistory {
  id: string;
  asset_id: string;
  action: string;
  details: string | null;
  performed_by: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

const CATEGORIES = ['laptop', 'desktop', 'phone', 'tablet', 'monitor', 'printer', 'networking', 'software', 'furniture', 'vehicle', 'other'];
const STATUS_OPTIONS: AssetStatus[] = ['available', 'assigned', 'maintenance', 'retired', 'lost'];
const CONDITION_OPTIONS: AssetCondition[] = ['new', 'good', 'fair', 'poor', 'damaged'];

const statusColors: Record<AssetStatus, string> = {
  available: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-none dark:text-emerald-400',
  assigned: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 shadow-none dark:text-indigo-400',
  maintenance: 'bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none dark:text-amber-400',
  retired: 'bg-slate-500/10 text-slate-600 border-slate-500/20 shadow-none dark:text-slate-400',
  lost: 'bg-rose-500/10 text-rose-600 border-rose-500/20 shadow-none dark:text-rose-400',
};

const conditionColors: Record<AssetCondition, string> = {
  new: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-none dark:text-emerald-400',
  good: 'bg-teal-500/10 text-teal-600 border-teal-500/20 shadow-none dark:text-teal-400',
  fair: 'bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none dark:text-amber-400',
  poor: 'bg-orange-500/10 text-orange-600 border-orange-500/20 shadow-none dark:text-orange-400',
  damaged: 'bg-rose-500/10 text-rose-600 border-rose-500/20 shadow-none dark:text-rose-400',
};

const categoryIcons: Record<string, typeof Monitor> = {
  laptop: Laptop, desktop: Monitor, phone: Smartphone,
  monitor: Monitor, printer: Printer, networking: HardDrive,
};

const emptyForm = {
  asset_name: '', asset_tag: '', category: 'other', brand: '', model: '',
  serial_number: '', purchase_date: '', purchase_price: 0, warranty_expiry: '',
  status: 'available' as AssetStatus, condition: 'new' as AssetCondition,
  location: '', notes: '', assigned_to: '',
};

export default function Assets() {
  const { role, user } = useAuth();
  const { sendNotification } = useNotifications();
  const { logActivity, logSecurity } = useActivityLog();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [deleteAsset, setDeleteAsset] = useState<Asset | null>(null);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);
  const [assignAsset, setAssignAsset] = useState<Asset | null>(null);
  const [assignEmpId, setAssignEmpId] = useState<string>('');
  const [form, setForm] = useState(emptyForm);

  // Fetch assets
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Asset[];
    },
  });

  // Fetch employees for assignment
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, user_id, designation')
        .eq('status', 'active');
      if (error) throw error;
      // Get profiles
      const userIds = data.map(e => e.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      return data.map(e => ({ ...e, full_name: profileMap.get(e.user_id) || 'Unknown' }));
    },
  });

  // Fetch history for selected asset
  const { data: history = [] } = useQuery({
    queryKey: ['asset-history', historyAsset?.id],
    enabled: !!historyAsset,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_history')
        .select('*')
        .eq('asset_id', historyAsset!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AssetHistory[];
    },
  });

  // Create asset
  const createMutation = useMutation({
    mutationFn: async (f: typeof emptyForm) => {
      const isAssigned = !!f.assigned_to;
      const finalStatus = isAssigned ? 'assigned' : f.status;
      
      const { data: newAsset, error } = await supabase.from('assets').insert({
        asset_name: f.asset_name,
        asset_tag: f.asset_tag,
        category: f.category,
        brand: f.brand || null,
        model: f.model || null,
        serial_number: f.serial_number || null,
        purchase_date: f.purchase_date || null,
        purchase_price: f.purchase_price,
        warranty_expiry: f.warranty_expiry || null,
        status: finalStatus,
        condition: f.condition,
        location: f.location || null,
        notes: f.notes || null,
        assigned_to: f.assigned_to || null,
        assigned_at: isAssigned ? new Date().toISOString() : null,
        created_by: user?.id || null,
      }).select().single();
      
      if (error) throw error;
      
      if (isAssigned && newAsset) {
        const emp = employees.find(e => e.id === f.assigned_to);
        await supabase.from('asset_history').insert({
          asset_id: newAsset.id,
          action: 'Assigned',
          details: `Assigned to ${emp?.full_name} upon creation`,
          performed_by: user?.id || null,
          new_value: emp?.full_name,
        });

        // Notify employee
        if (emp?.user_id) {
          sendNotification({
            userId: emp.user_id,
            title: 'New Asset Assigned',
            message: `You have been assigned a new asset: ${f.asset_name} (${f.asset_tag})`,
            type: 'info',
            actionLink: '/employee-portal'
          });
        }
      }
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset added');
      setAddOpen(false);
      setForm(emptyForm);
      logActivity('created', 'asset', variables.asset_name);
      logSecurity('CREATE', 'ASSET', `Created new company asset "${variables.asset_name}" (${variables.asset_tag})`);
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  // Update asset
  const updateMutation = useMutation({
    mutationFn: async ({ id, data: f }: { id: string; data: typeof emptyForm }) => {
      const isAssigned = !!f.assigned_to;
      const finalStatus = isAssigned ? 'assigned' : f.status;
      
      const { error } = await supabase.from('assets').update({
        asset_name: f.asset_name, asset_tag: f.asset_tag, category: f.category,
        brand: f.brand || null, model: f.model || null, serial_number: f.serial_number || null,
        purchase_date: f.purchase_date || null, purchase_price: f.purchase_price,
        warranty_expiry: f.warranty_expiry || null, status: finalStatus, condition: f.condition,
        location: f.location || null, notes: f.notes || null,
        assigned_to: f.assigned_to || null,
        assigned_at: isAssigned ? new Date().toISOString() : null,
      }).eq('id', id);
      if (error) throw error;
      // Log history
      await supabase.from('asset_history').insert({
        asset_id: id, action: 'Updated', details: `Asset details updated`,
        performed_by: user?.id || null,
      });
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset updated');
      setEditAsset(null);
      logActivity('updated', 'asset', variables.data.asset_name, variables.id);
      logSecurity('UPDATE', 'ASSET', `Updated details for company asset "${variables.data.asset_name}" (${variables.data.asset_tag})`, variables.id);
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  // Delete asset
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (data, variable) => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset deleted');
      setDeleteAsset(null);
      const assetItem = assets.find(a => a.id === variable);
      if (assetItem) {
        logActivity('deleted', 'asset', assetItem.asset_name, variable);
        logSecurity('DELETE', 'ASSET', `Deleted company asset "${assetItem.asset_name}" (${assetItem.asset_tag})`, variable);
      }
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  // Assign / Unassign
  const assignMutation = useMutation({
    mutationFn: async ({ assetId, employeeId }: { assetId: string; employeeId: string | null }) => {
      const emp = employees.find(e => e.id === employeeId);
      const { error } = await supabase.from('assets').update({
        assigned_to: employeeId, 
        assigned_at: employeeId ? new Date().toISOString() : null,
        status: employeeId ? 'assigned' : 'available',
      }).eq('id', assetId);
      if (error) throw error;
      
      const asset = assets.find(a => a.id === assetId);
      await supabase.from('asset_history').insert({
        asset_id: assetId,
        action: employeeId ? 'Assigned' : 'Unassigned',
        details: employeeId ? `Assigned to ${emp?.full_name}` : 'Returned to inventory',
        performed_by: user?.id || null,
        new_value: employeeId ? emp?.full_name : null,
      });

      // Notify employee on assignment
      if (employeeId && emp?.user_id) {
        sendNotification({
          userId: emp.user_id,
          title: 'Asset Assigned to You',
          message: `The asset "${asset.asset_name}" (${asset.asset_tag}) has been assigned to you.`,
          type: 'info',
          actionLink: '/employee-portal'
        });
      }
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Assignment updated');
      
      const asset = assets.find(a => a.id === variables.assetId);
      if (asset) {
        if (variables.employeeId) {
          const emp = employees.find(e => e.id === variables.employeeId);
          logActivity('assigned', 'asset', `${asset.asset_name} to ${emp?.full_name || 'employee'}`, variables.assetId);
          logSecurity('UPDATE', 'ASSET_ASSIGNMENT', `Assigned company asset "${asset.asset_name}" (${asset.asset_tag}) to employee "${emp?.full_name || 'employee'}"`, variables.assetId);
        } else {
          logActivity('unassigned', 'asset', asset.asset_name, variables.assetId);
          logSecurity('UPDATE', 'ASSET_ASSIGNMENT', `Unassigned/returned company asset "${asset.asset_name}" (${asset.asset_tag}) back to inventory`, variables.assetId);
        }
      }
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  // Filter
  const filtered = assets.filter(a => {
    const matchSearch = a.asset_name.toLowerCase().includes(search.toLowerCase()) ||
      a.asset_tag.toLowerCase().includes(search.toLowerCase()) ||
      (a.brand || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: assets.length,
    available: assets.filter(a => a.status === 'available').length,
    assigned: assets.filter(a => a.status === 'assigned').length,
    maintenance: assets.filter(a => a.status === 'maintenance').length,
    totalValue: assets.reduce((s, a) => s + (a.purchase_price || 0), 0),
  };

  const CategoryIcon = (cat: string) => categoryIcons[cat] || Package;

  // Shared form fields renderer
  const renderForm = (f: typeof emptyForm, setF: (v: typeof emptyForm) => void) => (
    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Asset Name *</Label>
          <Input className="rounded-xl border-border/60" value={f.asset_name} onChange={e => setF({ ...f, asset_name: e.target.value })} placeholder="MacBook Pro 16" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Asset Tag *</Label>
          <Input className="rounded-xl border-border/60" value={f.asset_tag} onChange={e => setF({ ...f, asset_tag: e.target.value })} placeholder="TW-001" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</Label>
          <Select value={f.category} onValueChange={v => setF({ ...f, category: v })}>
            <SelectTrigger className="rounded-xl border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Brand</Label>
          <Input className="rounded-xl border-border/60" value={f.brand || ''} onChange={e => setF({ ...f, brand: e.target.value })} placeholder="Apple" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Model</Label>
          <Input className="rounded-xl border-border/60" value={f.model || ''} onChange={e => setF({ ...f, model: e.target.value })} placeholder="M3 Max" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Serial Number</Label>
          <Input className="rounded-xl border-border/60" value={f.serial_number || ''} onChange={e => setF({ ...f, serial_number: e.target.value })} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Date</Label>
          <Input className="rounded-xl border-border/60" type="date" value={f.purchase_date || ''} onChange={e => setF({ ...f, purchase_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Price ($)</Label>
          <Input className="rounded-xl border-border/60" type="number" value={f.purchase_price} onChange={e => setF({ ...f, purchase_price: +e.target.value })} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Warranty Expiry</Label>
          <Input className="rounded-xl border-border/60" type="date" value={f.warranty_expiry || ''} onChange={e => setF({ ...f, warranty_expiry: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Location</Label>
          <Input className="rounded-xl border-border/60" value={f.location || ''} onChange={e => setF({ ...f, location: e.target.value })} placeholder="Office A" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</Label>
          <Select value={f.status} onValueChange={v => setF({ ...f, status: v as AssetStatus })}>
            <SelectTrigger className="rounded-xl border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assign To Employee</Label>
          <Select value={f.assigned_to || 'unassigned'} onValueChange={v => setF({ ...f, assigned_to: v === 'unassigned' ? '' : v })}>
            <SelectTrigger className="rounded-xl border-border/60"><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned (Available)</SelectItem>
              {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Condition</Label>
          <Select value={f.condition} onValueChange={v => setF({ ...f, condition: v as AssetCondition })}>
            <SelectTrigger className="rounded-xl border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>{CONDITION_OPTIONS.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notes</Label>
        <Textarea className="rounded-xl border-border/60" value={f.notes || ''} onChange={e => setF({ ...f, notes: e.target.value })} rows={2} />
      </div>
    </div>
  );

  if (isLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-2.5 tracking-tight text-slate-800 dark:text-slate-100">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Package className="h-6 w-6" />
              </div>
              Inventory & Assets
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">Track, allocate, and manage corporate inventory and hardware assets.</p>
          </div>
          {role === 'admin' && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 rounded-xl h-10 px-5 text-sm font-semibold transition-all duration-200" onClick={() => setForm(emptyForm)}>
                  <Plus className="h-4 w-4 mr-2" />Add Asset
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg rounded-2xl border-border/40 shadow-xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Add New Asset</DialogTitle>
                  <DialogDescription>Register a new asset in company inventory.</DialogDescription>
                </DialogHeader>
                {renderForm(form, setForm)}
                <DialogFooter className="gap-2">
                  <Button variant="outline" className="rounded-xl border-border/60" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button className="gradient-primary rounded-xl" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.asset_name || !form.asset_tag}>
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Asset
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Total Assets', value: stats.total, icon: Package, color: 'text-primary bg-primary/10' },
            { label: 'Available', value: stats.available, icon: Package, color: 'text-emerald-500 bg-emerald-500/10' },
            { label: 'Assigned', value: stats.assigned, icon: UserCheck, color: 'text-indigo-500 bg-indigo-500/10' },
            { label: 'Maintenance', value: stats.maintenance, icon: AlertTriangle, color: 'text-amber-500 bg-amber-500/10' },
            { label: 'Total Value', value: `$${stats.totalValue.toLocaleString()}`, icon: Package, color: 'text-teal-500 bg-teal-500/10' },
          ].map((s, i) => (
            <Card key={i} className="relative overflow-hidden bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 rounded-2xl hover:border-primary/25 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm p-4 col-span-1">
              <CardContent className="p-0 flex items-center justify-between">
                <div className="space-y-1 truncate">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{s.label}</p>
                  <div className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100">{s.value}</div>
                </div>
                <div className={`p-3 rounded-2xl ${s.color} shrink-0 ml-2`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search assets by tag, brand, or name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl border-border/60 bg-card/50 shadow-sm" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl border-border/60 bg-card/50 shadow-sm"><SelectValue placeholder="Filter status" /></SelectTrigger>
            <SelectContent className="rounded-xl border-border/40">
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Assets Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            All Assets <Badge variant="secondary" className="bg-primary/10 text-primary border-none shadow-none font-bold rounded-lg">{filtered.length}</Badge>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(asset => {
              const Icon = CategoryIcon(asset.category);
              const emp = employees.find(e => e.id === asset.assigned_to);
              return (
                <div 
                  key={asset.id} 
                  className="group relative bg-card/65 dark:bg-slate-900/65 backdrop-blur-md border border-border/40 hover:border-primary/25 hover:shadow-lg rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm overflow-hidden"
                >
                  <div>
                    {/* Badge header */}
                    <div className="flex justify-between items-start gap-2 mb-4">
                      <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-all duration-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge className={`border uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 ${statusColors[asset.status]}`}>
                          {asset.status}
                        </Badge>
                        <Badge className={`border uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 ${conditionColors[asset.condition]}`}>
                          {asset.condition}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors truncate">
                        {asset.asset_name}
                      </h3>
                      <p className="text-xs font-semibold text-muted-foreground bg-muted/60 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg w-fit border border-border/25">
                        Tag: <span className="font-extrabold text-slate-700 dark:text-slate-200">{asset.asset_tag}</span>
                      </p>
                      <p className="text-xs text-muted-foreground font-medium pt-1">
                        {asset.brand || 'No Brand'} {asset.model && `• ${asset.model}`}
                      </p>
                      {asset.location && (
                        <p className="text-[11px] text-muted-foreground font-semibold">
                          📍 Location: <span className="font-bold text-slate-700 dark:text-slate-300">{asset.location}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Footer / Assign Info */}
                  <div className="mt-5 pt-4 border-t border-border/40 flex justify-between items-center gap-2">
                    <div className="truncate">
                      {emp ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Assigned: <span className="font-bold truncate text-slate-800 dark:text-slate-100">{emp.full_name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                          <span>In Inventory</span>
                        </div>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted shrink-0 shadow-sm border border-border/10">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl shadow-lg border border-border/40">
                        {role === 'admin' && (
                          <>
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => { setEditAsset(asset); setForm({ asset_name: asset.asset_name, asset_tag: asset.asset_tag, category: asset.category, brand: asset.brand || '', model: asset.model || '', serial_number: asset.serial_number || '', purchase_date: asset.purchase_date || '', purchase_price: asset.purchase_price, warranty_expiry: asset.warranty_expiry || '', status: asset.status, condition: asset.condition, location: asset.location || '', notes: asset.notes || '', assigned_to: asset.assigned_to || '' }); }}>
                              <Edit className="h-4 w-4 mr-2 text-muted-foreground" />Edit Details
                            </DropdownMenuItem>
                            {asset.status !== 'assigned' ? (
                              <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => { setAssignAsset(asset); setAssignEmpId(''); }}>
                                <UserCheck className="h-4 w-4 mr-2 text-muted-foreground" />Assign Asset
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => assignMutation.mutate({ assetId: asset.id, employeeId: null })}>
                                <UserX className="h-4 w-4 mr-2 text-muted-foreground" />Unassign Asset
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-border/40" />
                          </>
                        )}
                        <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => setHistoryAsset(asset)}>
                          <History className="h-4 w-4 mr-2 text-muted-foreground" />View History
                        </DropdownMenuItem>
                        {role === 'admin' && (
                          <>
                            <DropdownMenuSeparator className="bg-border/40" />
                            <DropdownMenuItem className="rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer" onClick={() => setDeleteAsset(asset)}>
                              <Trash2 className="h-4 w-4 mr-2" />Delete Asset
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed rounded-3xl border-border/40 bg-card/20 max-w-sm mx-auto">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200">No Assets Found</h3>
              <p className="text-xs text-muted-foreground mt-1 px-4">There are no assets matching your criteria at this moment.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editAsset} onOpenChange={o => !o && setEditAsset(null)}>
        <DialogContent className="max-w-lg rounded-2xl border-border/40 shadow-xl">
          <DialogHeader><DialogTitle className="text-xl font-bold">Edit Asset</DialogTitle><DialogDescription>Update asset details in inventory.</DialogDescription></DialogHeader>
          {renderForm(form, setForm)}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl border-border/60" onClick={() => setEditAsset(null)}>Cancel</Button>
            <Button className="gradient-primary rounded-xl" onClick={() => editAsset && updateMutation.mutate({ id: editAsset.id, data: form })} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyAsset} onOpenChange={o => !o && setHistoryAsset(null)}>
        <DialogContent className="max-w-md rounded-2xl border-border/40 shadow-xl">
          <DialogHeader><DialogTitle className="text-xl font-bold">Asset History — {historyAsset?.asset_name}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
            {history.length === 0 && <p className="text-muted-foreground text-center py-8">No action logs found for this asset.</p>}
            {history.map(h => (
              <div key={h.id} className="flex gap-3 p-3 rounded-xl border border-border/40 bg-muted/20">
                <History className="h-4 w-4 mt-1 text-primary flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{h.action}</p>
                  {h.details && <p className="text-xs text-muted-foreground mt-0.5">{h.details}</p>}
                  <p className="text-[10px] text-muted-foreground mt-2 font-medium bg-muted dark:bg-slate-800 px-2 py-0.5 rounded border border-border/20 w-fit">{format(new Date(h.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteAsset} onOpenChange={o => !o && setDeleteAsset(null)}>
        <AlertDialogContent className="rounded-2xl border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteAsset?.asset_name}"? This action cannot be undone and will remove it permanently from database inventory.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-border/60">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAsset && deleteMutation.mutate(deleteAsset.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Delete Asset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Dialog */}
      <Dialog open={!!assignAsset} onOpenChange={o => !o && setAssignAsset(null)}>
        <DialogContent className="max-w-md rounded-2xl border-border/40 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Assign Asset</DialogTitle>
            <DialogDescription>Select an employee to allocate "{assignAsset?.asset_name}" to.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Employee</Label>
            <Select value={assignEmpId} onValueChange={setAssignEmpId}>
              <SelectTrigger className="rounded-xl border-border/60"><SelectValue placeholder="Select an employee..." /></SelectTrigger>
              <SelectContent className="rounded-xl border-border/40">
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id} className="cursor-pointer">{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl border-border/60" onClick={() => setAssignAsset(null)}>Cancel</Button>
            <Button className="gradient-primary rounded-xl" onClick={() => { assignMutation.mutate({ assetId: assignAsset!.id, employeeId: assignEmpId }); setAssignAsset(null); }} disabled={!assignEmpId || assignMutation.isPending}>
              Assign Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
