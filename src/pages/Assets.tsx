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
  available: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  retired: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const conditionColors: Record<AssetCondition, string> = {
  new: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  good: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  fair: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  poor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  damaged: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Asset added'); setAddOpen(false); setForm(emptyForm); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Asset updated'); setEditAsset(null); },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  // Delete asset
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Asset deleted'); setDeleteAsset(null); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Assignment updated'); },
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
    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Asset Name *</Label><Input value={f.asset_name} onChange={e => setF({ ...f, asset_name: e.target.value })} placeholder="MacBook Pro 16" /></div>
        <div><Label>Asset Tag *</Label><Input value={f.asset_tag} onChange={e => setF({ ...f, asset_tag: e.target.value })} placeholder="TW-001" /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Category</Label>
          <Select value={f.category} onValueChange={v => setF({ ...f, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Brand</Label><Input value={f.brand} onChange={e => setF({ ...f, brand: e.target.value })} placeholder="Apple" /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Model</Label><Input value={f.model} onChange={e => setF({ ...f, model: e.target.value })} placeholder="M3 Max" /></div>
        <div><Label>Serial Number</Label><Input value={f.serial_number} onChange={e => setF({ ...f, serial_number: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Purchase Date</Label><Input type="date" value={f.purchase_date} onChange={e => setF({ ...f, purchase_date: e.target.value })} /></div>
        <div><Label>Purchase Price</Label><Input type="number" value={f.purchase_price} onChange={e => setF({ ...f, purchase_price: +e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Warranty Expiry</Label><Input type="date" value={f.warranty_expiry} onChange={e => setF({ ...f, warranty_expiry: e.target.value })} /></div>
        <div><Label>Location</Label><Input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="Office A" /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Status</Label>
          <Select value={f.status} onValueChange={v => setF({ ...f, status: v as AssetStatus })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Assign To Employee</Label>
          <Select value={f.assigned_to || 'unassigned'} onValueChange={v => setF({ ...f, assigned_to: v === 'unassigned' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned (Available)</SelectItem>
              {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Condition</Label>
          <Select value={f.condition} onValueChange={v => setF({ ...f, condition: v as AssetCondition })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CONDITION_OPTIONS.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Notes</Label><Textarea value={f.notes || ''} onChange={e => setF({ ...f, notes: e.target.value })} rows={2} /></div>
    </div>
  );

  if (isLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Inventory & Assets</h1>
            <p className="text-muted-foreground mt-1">Track and manage company assets</p>
          </div>
          {role === 'admin' && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary" onClick={() => setForm(emptyForm)}>
                  <Plus className="h-4 w-4 mr-2" />Add Asset
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Asset</DialogTitle>
                  <DialogDescription>Register a new asset in inventory.</DialogDescription>
                </DialogHeader>
                {renderForm(form, setForm)}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button className="gradient-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.asset_name || !form.asset_tag}>
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          {[
            { label: 'Total Assets', value: stats.total, icon: Package, color: 'text-primary' },
            { label: 'Available', value: stats.available, icon: Package, color: 'text-green-500' },
            { label: 'Assigned', value: stats.assigned, icon: UserCheck, color: 'text-blue-500' },
            { label: 'Maintenance', value: stats.maintenance, icon: AlertTriangle, color: 'text-yellow-500' },
            { label: 'Total Value', value: `$${stats.totalValue.toLocaleString()}`, icon: Package, color: 'text-emerald-500' },
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Assets List */}
        <Card className="glass-card">
          <CardHeader><CardTitle>All Assets ({filtered.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filtered.map(asset => {
                const Icon = CategoryIcon(asset.category);
                const emp = employees.find(e => e.id === asset.assigned_to);
                return (
                  <div key={asset.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-6 w-6 text-primary" /></div>
                      <div>
                        <p className="font-medium">{asset.asset_name}</p>
                        <p className="text-sm text-muted-foreground">{asset.asset_tag} • {asset.brand} {asset.model}</p>
                        {emp && <p className="text-xs text-blue-500 mt-0.5">Assigned to: {emp.full_name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={conditionColors[asset.condition]}>{asset.condition}</Badge>
                      <Badge className={statusColors[asset.status]}>{asset.status}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {role === 'admin' && (
                            <>
                              <DropdownMenuItem onClick={() => { setEditAsset(asset); setForm({ asset_name: asset.asset_name, asset_tag: asset.asset_tag, category: asset.category, brand: asset.brand || '', model: asset.model || '', serial_number: asset.serial_number || '', purchase_date: asset.purchase_date || '', purchase_price: asset.purchase_price, warranty_expiry: asset.warranty_expiry || '', status: asset.status, condition: asset.condition, location: asset.location || '', notes: asset.notes || '', assigned_to: asset.assigned_to || '' }); }}>
                                <Edit className="h-4 w-4 mr-2" />Edit
                              </DropdownMenuItem>
                              {asset.status !== 'assigned' ? (
                                <DropdownMenuItem onClick={() => { setAssignAsset(asset); setAssignEmpId(''); }}>
                                  <UserCheck className="h-4 w-4 mr-2" />Assign
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => assignMutation.mutate({ assetId: asset.id, employeeId: null })}>
                                  <UserX className="h-4 w-4 mr-2" />Unassign
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem onClick={() => setHistoryAsset(asset)}>
                            <History className="h-4 w-4 mr-2" />View History
                          </DropdownMenuItem>
                          {role === 'admin' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteAsset(asset)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No assets found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editAsset} onOpenChange={o => !o && setEditAsset(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Asset</DialogTitle><DialogDescription>Update asset details.</DialogDescription></DialogHeader>
          {renderForm(form, setForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAsset(null)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => editAsset && updateMutation.mutate({ id: editAsset.id, data: form })} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyAsset} onOpenChange={o => !o && setHistoryAsset(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Asset History — {historyAsset?.asset_name}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {history.length === 0 && <p className="text-muted-foreground text-center py-4">No history yet</p>}
            {history.map(h => (
              <div key={h.id} className="flex gap-3 p-3 rounded-lg border">
                <History className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">{h.action}</p>
                  {h.details && <p className="text-xs text-muted-foreground">{h.details}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(h.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteAsset} onOpenChange={o => !o && setDeleteAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteAsset?.asset_name}"? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAsset && deleteMutation.mutate(deleteAsset.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Dialog */}
      <Dialog open={!!assignAsset} onOpenChange={o => !o && setAssignAsset(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Asset</DialogTitle>
            <DialogDescription>Select an employee to assign "{assignAsset?.asset_name}" to.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Employee</Label>
            <Select value={assignEmpId} onValueChange={setAssignEmpId}>
              <SelectTrigger><SelectValue placeholder="Select an employee..." /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignAsset(null)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => { assignMutation.mutate({ assetId: assignAsset!.id, employeeId: assignEmpId }); setAssignAsset(null); }} disabled={!assignEmpId || assignMutation.isPending}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
