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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Megaphone, FileText, Plus, Trash2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function PortalAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  
  const [announceDialogOpen, setAnnounceDialogOpen] = useState(false);
  const [announceData, setAnnounceData] = useState({ title: '', content: '', type: 'general' });

  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docData, setDocData] = useState({ user_id: '', title: '', document_url: '', type: 'other' });

  // Fetch Users for document assignment
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email');
      if (error) throw error;
      return data;
    }
  });

  // Fetch Announcements
  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_announcements').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch Documents
  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['admin-documents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employee_documents').select('*, profiles:user_id (full_name, email)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

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

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('company_announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement deleted');
    }
  });

  const uploadDocument = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('employee_documents').insert({
        ...payload,
        uploaded_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-documents'] });
      
      // Notify the specific employee
      sendNotification({
        userId: docData.user_id,
        title: 'New Document in Vault',
        message: `A new document "${docData.title}" has been uploaded to your secure vault.`,
        type: 'success',
        actionLink: '/employee-portal'
      });

      toast.success('Document uploaded to Vault!');
      setDocDialogOpen(false);
      setDocData({ user_id: '', title: '', document_url: '', type: 'other' });
    },
    onError: (e) => toast.error('Failed to upload: ' + e.message)
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employee_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-documents'] });
      toast.success('Document removed');
    }
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Megaphone className="h-8 w-8 text-primary" /> Portal Admin</h1>
          <p className="text-muted-foreground mt-1">Manage company announcements and employee document vaults.</p>
        </div>

        <Tabs defaultValue="announcements" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="documents">Document Vault</TabsTrigger>
          </TabsList>

          {/* ANNOUNCEMENTS TAB */}
          <TabsContent value="announcements" className="mt-6 space-y-4">
            <div className="flex justify-end">
              <Button className="gradient-primary" onClick={() => setAnnounceDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Announcement</Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Bulletin Board</CardTitle>
                <CardDescription>Live company announcements visible to all employees</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAnnouncements ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">No announcements posted.</div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((a: any) => (
                      <div key={a.id} className="flex justify-between items-start p-4 border rounded-lg hover:bg-muted/30">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{a.title}</h4>
                            <Badge variant={a.type === 'urgent' ? 'destructive' : 'secondary'} className="capitalize">{a.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">{format(new Date(a.created_at), 'PPP p')}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deleteAnnouncement.mutate(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DOCUMENTS TAB */}
          <TabsContent value="documents" className="mt-6 space-y-4">
            <div className="flex justify-end">
              <Button className="gradient-primary" onClick={() => setDocDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Upload Document</Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Employee Document Vaults</CardTitle>
                <CardDescription>Securely share PDFs, contracts, and payslips with specific employees</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDocs ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">No documents uploaded.</div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((d: any) => (
                      <div key={d.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/30">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{d.title}</p>
                            <p className="text-xs text-muted-foreground">Owner: {d.profiles?.full_name || d.profiles?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="capitalize">{d.type}</Badge>
                          {d.document_url && (
                            <a href={d.document_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1">
                              <LinkIcon className="h-3 w-3" /> Link
                            </a>
                          )}
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 ml-2" onClick={() => deleteDocument.mutate(d.id)}>
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

      {/* ANNOUNCEMENT DIALOG */}
      <Dialog open={announceDialogOpen} onOpenChange={o => !o && setAnnounceDialogOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title</Label>
              <Input placeholder="e.g. Welcome new team members!" value={announceData.title} onChange={e => setAnnounceData({...announceData, title: e.target.value})} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={announceData.type} onValueChange={v => setAnnounceData({...announceData, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="event">Event / Social</SelectItem>
                  <SelectItem value="hr">HR Policy</SelectItem>
                  <SelectItem value="urgent">Urgent / Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea className="min-h-[100px]" value={announceData.content} onChange={e => setAnnounceData({...announceData, content: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnounceDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => createAnnouncement.mutate(announceData)} disabled={createAnnouncement.isPending || !announceData.title || !announceData.content}>Publish to Portal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DOCUMENT DIALOG */}
      <Dialog open={docDialogOpen} onOpenChange={o => !o && setDocDialogOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload to Document Vault</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Employee</Label>
              <Select value={docData.user_id} onValueChange={v => setDocData({...docData, user_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select an employee..." /></SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document Title</Label>
              <Input placeholder="e.g. March 2026 Payslip" value={docData.title} onChange={e => setDocData({...docData, title: e.target.value})} />
            </div>
            <div>
              <Label>Document Type</Label>
              <Select value={docData.type} onValueChange={v => setDocData({...docData, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Employment Contract</SelectItem>
                  <SelectItem value="payslip">Payslip</SelectItem>
                  <SelectItem value="policy">Policy / NDA</SelectItem>
                  <SelectItem value="tax">Tax Form</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>File URL (G-Drive, Dropbox, etc)</Label>
              <Input placeholder="https://..." value={docData.document_url} onChange={e => setDocData({...docData, document_url: e.target.value})} />
              <p className="text-xs text-muted-foreground mt-1">For now, paste an external secure link to the PDF.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => uploadDocument.mutate(docData)} disabled={uploadDocument.isPending || !docData.user_id || !docData.title}>Send to Vault</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
