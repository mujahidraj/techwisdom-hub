import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Megaphone, FileText, Plus, Trash2, Link as LinkIcon, Upload, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function PortalAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { sendNotification } = useNotifications();

  // Dialog Open States
  const [announceDialogOpen, setAnnounceDialogOpen] = useState(false);
  const [announceData, setAnnounceData] = useState({ title: '', content: '', type: 'general' });

  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docData, setDocData] = useState({ user_id: '', title: '', type: 'other' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Fetch Users for document assignment
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch Announcements
  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_announcements').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch Documents
  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['admin-documents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employee_documents').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];
      
      const rawData = data as any[];
      const userIds = [...new Set(rawData.map(r => r.user_id))];
      
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
        
      if (profErr) {
        console.error("Profiles fetch fail:", profErr);
      }
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return rawData.map(r => ({
        ...r,
        profiles: profileMap.get(r.user_id) || null
      }));
    }
  });

  // Create Announcement Mutation
  const createAnnouncement = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('company_announcements').insert({
        ...payload,
        author_id: user?.id,
        is_published: true
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });

      // Notify all employees & admins
      sendNotification({
        title: 'New Company Announcement',
        message: announceData.title,
        type: announceData.type === 'urgent' ? 'error' : 'info',
        targetRoles: ['employee', 'admin'],
        actionLink: '/employee-portal'
      });

      toast.success('Announcement published!');
      setAnnounceDialogOpen(false);
      setAnnounceData({ title: '', content: '', type: 'general' });
    },
    onError: (e) => toast.error('Failed to publish: ' + e.message)
  });

  // Delete Announcement Mutation
  const deleteAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('company_announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement deleted');
    },
    onError: (e) => toast.error('Failed to delete: ' + e.message)
  });

  // Upload Document Mutation (Stores in Supabase Storage secure bucket)
  const uploadDocument = useMutation({
    mutationFn: async (payload: any) => {
      if (!selectedFile) throw new Error("Please select a file to upload");

      setUploadingFile(true);

      // Generate clean unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${payload.user_id}/${fileName}`;

      // 1. Upload to Supabase Storage Bucket 'employee-documents'
      const { error: storageErr } = await supabase.storage
        .from('employee-documents')
        .upload(filePath, selectedFile);

      if (storageErr) throw new Error("Storage Upload Error: " + storageErr.message);

      // 2. Retrieve Public / Direct Access URL
      const { data: { publicUrl } } = supabase.storage
        .from('employee-documents')
        .getPublicUrl(filePath);

      // 3. Save reference in employee_documents table
      const { error: dbErr } = await supabase.from('employee_documents').insert({
        user_id: payload.user_id,
        title: payload.title,
        document_url: publicUrl,
        type: payload.type,
        uploaded_by: user?.id
      });

      if (dbErr) {
        // Rollback Storage file if Database reference record creation fails
        await supabase.storage.from('employee-documents').remove([filePath]);
        throw new Error("Database Reference Error: " + dbErr.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-documents'] });

      // Notify employee
      sendNotification({
        userId: docData.user_id,
        title: 'New Document in Vault',
        message: `A new document "${docData.title}" has been uploaded to your secure vault.`,
        type: 'success',
        actionLink: '/employee-portal'
      });

      toast.success('Document stored securely in Vault!');
      setDocDialogOpen(false);
      setDocData({ user_id: '', title: '', type: 'other' });
      setSelectedFile(null);
      setUploadingFile(false);
    },
    onError: (e) => {
      setUploadingFile(false);
      toast.error('Upload Failed: ' + e.message);
    }
  });

  // Delete Document Mutation (Cleans DB and Storage objects)
  const deleteDocument = useMutation({
    mutationFn: async (doc: any) => {
      // 1. Delete physical storage file if URL exists
      if (doc.document_url) {
        try {
          const pathPart = doc.document_url.split('employee-documents/')[1];
          if (pathPart) {
            await supabase.storage.from('employee-documents').remove([pathPart]);
          }
        } catch (e) {
          console.error("Storage cleanup failed:", e);
        }
      }

      // 2. Remove DB entry record
      const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-documents'] });
      toast.success('Document removed from Vault');
    },
    onError: (e) => toast.error('Failed to delete: ' + e.message)
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12 w-full max-w-full overflow-hidden">
        {/* Portal Admin Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <Megaphone className="h-5 w-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Portal Admin Center</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Publish announcements, update the company bulletin board, and manage secure document vaults.
            </p>
          </div>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="announcements" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-xl">
            <TabsTrigger value="announcements" className="rounded-lg text-xs font-bold py-2">Company Bulletin</TabsTrigger>
            <TabsTrigger value="documents" className="rounded-lg text-xs font-bold py-2">Document Vault</TabsTrigger>
          </TabsList>

          {/* BULLETIN BOARD TAB */}
          <TabsContent value="announcements" className="mt-6 space-y-4">
            <div className="flex justify-end">
              <Button className="gradient-primary text-xs font-bold uppercase tracking-wider py-4 px-5 rounded-xl shadow-sm" onClick={() => setAnnounceDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> New Announcement
              </Button>
            </div>
            <Card className="glass-card shadow-sm border border-slate-200/60 dark:border-slate-850/40 rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50/40 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800/30">
                <CardTitle className="text-base font-bold text-slate-855 dark:text-slate-100">Bulletin Board</CardTitle>
                <CardDescription className="text-xs">Live company updates broadcasted to all logged-in employees</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {loadingAnnouncements ? (
                  <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <Megaphone className="h-10 w-10 mx-auto text-slate-300 opacity-60" />
                    <p className="text-xs font-semibold">No announcements posted on the bulletin board.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {announcements.map((a: any) => (
                      <div key={a.id} className="flex justify-between items-start p-4 bg-slate-50/40 dark:bg-slate-900/10 border border-slate-150 dark:border-slate-800/40 rounded-xl hover:shadow-sm transition-all duration-200">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{a.title}</h4>
                            <Badge className={`font-bold px-2 py-0.5 text-[9px] rounded-md border-none ${a.type === 'urgent' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400' :
                              a.type === 'event' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450' :
                                a.type === 'hr' ? 'bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400' :
                                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}>
                              {a.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed whitespace-pre-wrap">{a.content}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{format(new Date(a.created_at), 'PPP p')}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl shrink-0"
                          onClick={() => {
                            if (window.confirm("Permanently delete this announcement?")) {
                              deleteAnnouncement.mutate(a.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SECURE DOCUMENTS VAULT TAB */}
          <TabsContent value="documents" className="mt-6 space-y-4">
            <div className="flex justify-end">
              <Button className="gradient-primary text-xs font-bold uppercase tracking-wider py-4 px-5 rounded-xl shadow-sm" onClick={() => setDocDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Upload Document
              </Button>
            </div>
            <Card className="glass-card shadow-sm border border-slate-200/60 dark:border-slate-850/40 rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50/40 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800/30">
                <CardTitle className="text-base font-bold text-slate-855 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="h-5 w-5 text-indigo-500" />
                  Employee Document Vaults
                </CardTitle>
                <CardDescription className="text-xs">Securely upload and share official payslips, contracts, or tax returns with specific employees</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {loadingDocs ? (
                  <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <FileText className="h-10 w-10 mx-auto text-slate-300 opacity-60" />
                    <p className="text-xs font-semibold">No secure employee documents uploaded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((d: any) => (
                      <div key={d.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-4 bg-slate-50/40 dark:bg-slate-900/10 border border-slate-150 dark:border-slate-800/40 rounded-xl hover:shadow-sm transition-all duration-200">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-500 shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{d.title}</p>
                            <p className="text-[10px] text-slate-550 dark:text-slate-400 font-semibold">Owner: {d.profiles?.full_name || d.profiles?.email || 'Unknown User'}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                          <Badge className="bg-slate-100 text-slate-600 border-none dark:bg-slate-800 dark:text-slate-400 font-bold px-2 py-0.5 text-[9px] rounded-md capitalize shadow-none">{d.type}</Badge>
                          {d.document_url && (
                            <a
                              href={d.document_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-bold text-xs flex items-center gap-1 hover:underline bg-indigo-50 dark:bg-indigo-950/40 py-1.5 px-3 rounded-lg border border-indigo-100/50 dark:border-indigo-950/60"
                            >
                              <LinkIcon className="h-3 w-3" /> View Document
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl shrink-0"
                            onClick={() => {
                              if (window.confirm(`Permanently remove document "${d.title}" from this employee's vault?`)) {
                                deleteDocument.mutate(d);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ANNOUNCEMENT PUBLISH DIALOG */}
      <Dialog open={announceDialogOpen} onOpenChange={o => !o && setAnnounceDialogOpen(false)}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-2xl animate-fade-in">
          <DialogHeader className="p-6 pb-0 relative">
            <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl">
                <Megaphone className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Post Announcement</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">Broadcast new notices to all employees instantly.</DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Notice Title</Label>
              <Input
                placeholder="e.g. Welcome new team members!"
                value={announceData.title}
                onChange={e => setAnnounceData({ ...announceData, title: e.target.value })}
                className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Category</Label>
              <Select value={announceData.type} onValueChange={v => setAnnounceData({ ...announceData, type: v })}>
                <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="general" className="text-xs font-semibold">General Info</SelectItem>
                  <SelectItem value="event" className="text-xs font-semibold">Event / Socials</SelectItem>
                  <SelectItem value="hr" className="text-xs font-semibold">HR Policy</SelectItem>
                  <SelectItem value="urgent" className="text-xs font-semibold">Urgent Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Message Content</Label>
              <Textarea
                placeholder="Type your bulletin post here..."
                className="min-h-[110px] rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold leading-relaxed"
                value={announceData.content}
                onChange={e => setAnnounceData({ ...announceData, content: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2 flex gap-2 border-t border-slate-100 dark:border-slate-800/30">
              <Button
                variant="outline"
                onClick={() => setAnnounceDialogOpen(false)}
                className="rounded-xl text-xs font-bold h-11 border-slate-200 dark:border-slate-800 flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => createAnnouncement.mutate(announceData)}
                disabled={createAnnouncement.isPending || !announceData.title || !announceData.content}
                className="rounded-xl text-xs font-bold h-11 gradient-primary flex-1"
              >
                {createAnnouncement.isPending ? 'Publishing...' : 'Publish to Board'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* DOCUMENT VAULT UPLOAD DIALOG */}
      <Dialog open={docDialogOpen} onOpenChange={o => !o && setDocDialogOpen(false)}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-2xl animate-fade-in">
          <DialogHeader className="p-6 pb-0 relative">
            <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl">
                <Upload className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Upload to Document Vault</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">Store actual document files in the database vault.</DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Select Employee</Label>
              <Select value={docData.user_id} onValueChange={v => setDocData({ ...docData, user_id: v })}>
                <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs">
                  <SelectValue placeholder="Select employee profile..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {users.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id} className="text-xs font-semibold">
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Document Title</Label>
              <Input
                placeholder="e.g. March 2026 Payslip"
                value={docData.title}
                onChange={e => setDocData({ ...docData, title: e.target.value })}
                className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs font-semibold"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Document Type</Label>
              <Select value={docData.type} onValueChange={v => setDocData({ ...docData, type: v })}>
                <SelectTrigger className="h-11 rounded-xl border-slate-250 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/15 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="contract" className="text-xs font-semibold">Employment Contract</SelectItem>
                  <SelectItem value="payslip" className="text-xs font-semibold">Payslip</SelectItem>
                  <SelectItem value="policy" className="text-xs font-semibold">Policy / NDA</SelectItem>
                  <SelectItem value="tax" className="text-xs font-semibold">Tax Form</SelectItem>
                  <SelectItem value="other" className="text-xs font-semibold">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Drag & Drop File Selector Container */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Upload File</Label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl p-6 text-center hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-all cursor-pointer relative group">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                  <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Drag & drop or click to choose</p>
                  <p className="text-[10px] text-slate-400 font-medium">Supports PDF, Word, Images, and Sheets (Max 10MB)</p>
                </div>
              </div>

              {selectedFile && (
                <div className="flex items-center gap-2 p-2.5 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/50 dark:border-indigo-950/30 text-indigo-650 dark:text-indigo-400 text-xs font-extrabold">
                  <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="truncate flex-1">{selectedFile.name}</span>
                  <span className="text-[10px] text-slate-450">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 flex gap-2 border-t border-slate-100 dark:border-slate-800/30">
              <Button
                variant="outline"
                onClick={() => {
                  setDocDialogOpen(false);
                  setSelectedFile(null);
                }}
                disabled={uploadingFile}
                className="rounded-xl text-xs font-bold h-11 border-slate-200 dark:border-slate-800 flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => uploadDocument.mutate(docData)}
                disabled={uploadDocument.isPending || uploadingFile || !docData.user_id || !docData.title || !selectedFile}
                className="rounded-xl text-xs font-bold h-11 gradient-primary flex-1 shadow-sm"
              >
                {uploadDocument.isPending || uploadingFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading...</span>
                  </div>
                ) : (
                  'Send to Vault'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
