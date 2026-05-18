import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Edit, Trash2, Loader2, ArrowLeft, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'array' | 'boolean' | 'number' | 'json';
  required?: boolean;
  placeholder?: string;
}

interface Props {
  title: string;
  table: string;
  fields: FieldDef[];
  cardRender: (item: any) => React.ReactNode;
  queryKey: string;
  jsonKey?: string;
  onUpload?: (data: any) => Promise<void>;
}

export function CMSCrudPage({ title, table, fields, cardRender, queryKey, jsonKey, onUpload }: Props) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      // Fetch without order to avoid "column does not exist" errors on tables without display_order
      const { data, error } = await (supabase as any).from(table).select('*');
      if (error) throw error;
      
      // Sort client-side
      const sortedData = (data || []).sort((a: any, b: any) => {
        if (a.display_order !== undefined && b.display_order !== undefined) {
          return a.display_order - b.display_order;
        }
        // Fallback to created_at if available
        if (a.created_at && b.created_at) {
           return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return 0;
      });
      
      return sortedData;
    },
  });

  const resetForm = () => {
    const empty: Record<string, any> = {};
    fields.forEach(f => {
      if (f.type === 'boolean') empty[f.key] = true;
      else if (f.type === 'number') empty[f.key] = 0;
      else empty[f.key] = '';
    });
    setForm(empty);
    setEditId(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (item: any) => {
    const formData: Record<string, any> = {};
    fields.forEach(f => {
      if (f.type === 'array') formData[f.key] = (item[f.key] || []).join('\n');
      else if (f.type === 'json') formData[f.key] = JSON.stringify(item[f.key] || [], null, 2);
      else formData[f.key] = item[f.key] ?? (f.type === 'boolean' ? true : f.type === 'number' ? 0 : '');
    });
    setForm(formData);
    setEditId(item.id);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {};
      fields.forEach(f => {
        if (f.type === 'array') payload[f.key] = form[f.key] ? String(form[f.key]).split('\n').map((s: string) => s.trim()).filter(Boolean) : [];
        else if (f.type === 'json') { try { payload[f.key] = JSON.parse(form[f.key] || '[]'); } catch { payload[f.key] = []; } }
        else if (f.type === 'number') payload[f.key] = Number(form[f.key]) || 0;
        else payload[f.key] = form[f.key];
      });

      if (editId) {
        const { error } = await (supabase as any).from(table).update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); toast.success(editId ? 'Updated' : 'Created'); setDialogOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); toast.success('Deleted'); setDeleteId(null); },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (json: any) => {
      if (onUpload) {
        await onUpload(json);
        return;
      }

      let data = json;
      if (jsonKey && json[jsonKey]) {
         data = json[jsonKey];
      } else if (json[queryKey]) {
         data = json[queryKey];
      }

      if (!Array.isArray(data)) {
        data = [data];
      }
      
      const toSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      const formatData = data.map((item: any) => {
        const formatted: Record<string, any> = {};
        for (const [key, value] of Object.entries(item)) {
          let dbKey = toSnake(key);
          
          // Fix: Prevent inserting string IDs into the UUID primary key 'id' column
          if (dbKey === 'id' && typeof value === 'string') {
             const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
             if (!isUUID) {
                // Map the string ID to the correct table-specific column
                if (table === 'cms_products') dbKey = 'product_id';
                else if (table === 'cms_demo_projects') dbKey = 'project_id';
                else if (table === 'cms_job_openings') dbKey = 'job_id';
                else if (table === 'cms_services' || table === 'cms_service_details') dbKey = 'service_id';
                else if (table === 'cms_portfolio') dbKey = 'project_id';
                else if (table === 'cms_blog_posts') dbKey = 'slug';
                else continue; // If we can't map it, skip 'id' entirely so Supabase generates a UUID
             }
          }
          
          // Fix: prevent trying to insert unsupported nested objects or columns not in DB
          if (dbKey === 'comparison' || dbKey === 'platforms' || dbKey === 'pricing') continue;

          formatted[dbKey] = value;
        }
        return formatted;
      });
      
      let conflictKey = 'id';
      if (table === 'cms_products') conflictKey = 'product_id';
      else if (table === 'cms_demo_projects') conflictKey = 'project_id';
      else if (table === 'cms_job_openings') conflictKey = 'job_id';
      else if (table === 'cms_services' || table === 'cms_service_details') conflictKey = 'service_id';
      else if (table === 'cms_portfolio') conflictKey = 'project_id';
      else if (table === 'cms_blog_posts') conflictKey = 'slug';

      // Deduplicate payload to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
      const uniqueDataMap = new Map();
      formatData.forEach(item => {
        const key = item[conflictKey];
        if (key) {
          uniqueDataMap.set(key, item); // Keeps the last occurrence
        } else {
          uniqueDataMap.set(Math.random().toString(), item);
        }
      });
      const deduplicatedData = Array.from(uniqueDataMap.values());

      const { error } = await (supabase as any).from(table).upsert(deduplicatedData, { onConflict: conflictKey });
      if (error) throw error;
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: [queryKey] }); 
      toast.success('Bulk uploaded successfully'); 
    },
    onError: (e: any) => toast.error(`Bulk upload failed: ${e.message}`),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        bulkUploadMutation.mutate(json);
      } catch (err) {
        toast.error('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    // clear input
    e.target.value = '';
  };

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/cms')}><ArrowLeft className="h-5 w-5" /></Button>
            <div><h1 className="text-xl sm:text-2xl font-bold">{title}</h1><p className="text-xs sm:text-sm text-muted-foreground">{items.length} items</p></div>
          </div>
          {role === 'admin' && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
              <div className="w-full sm:w-auto">
                <input type="file" id={`upload-${table}`} className="hidden" accept=".json" onChange={handleFileUpload} disabled={bulkUploadMutation.isPending} />
                <Label htmlFor={`upload-${table}`} className="cursor-pointer w-full">
                  <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full sm:w-auto">
                    {bulkUploadMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Upload JSON
                  </div>
                </Label>
              </div>
              <Button className="gradient-primary w-full sm:w-auto" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />Add New
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item: any) => (
            <Card key={item.id} className="glass-card group">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">{cardRender(item)}</div>
                  {role === 'admin' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(item)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteId(item.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">No items yet</div>}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit' : 'Add'} {title.replace(/s$/, '')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {fields.map(f => (
              <div key={f.key}>
                <Label>{f.label}{f.required && ' *'}</Label>
                {f.type === 'boolean' ? (
                  <div className="flex items-center gap-2 mt-1"><Switch checked={!!form[f.key]} onCheckedChange={v => setForm({ ...form, [f.key]: v })} /><span className="text-sm">{form[f.key] ? 'Yes' : 'No'}</span></div>
                ) : f.type === 'textarea' || f.type === 'array' || f.type === 'json' ? (
                  <Textarea value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder || (f.type === 'array' ? 'One per line' : '')} rows={f.type === 'json' ? 6 : 3} className={f.type === 'json' ? 'font-mono text-sm' : ''} />
                ) : f.type === 'number' ? (
                  <Input type="number" value={form[f.key] || 0} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <Input value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Item</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
