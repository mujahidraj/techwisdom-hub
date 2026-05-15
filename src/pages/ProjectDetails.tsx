/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import { 
  ArrowLeft, Building, Calendar, DollarSign, CheckSquare, 
  MessageSquare, Send, Edit, FileText, Paperclip, Download, 
  Loader2, Trash2, X, Activity, LifeBuoy, ThumbsUp, UploadCloud
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const STAGES = [
  'discovery', 'requirement', 'strategy', 'design', 
  'development', 'qa', 'deployment', 'maintenance'
];

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // States
  const [noteInput, setNoteInput] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [approvalTitle, setApprovalTitle] = useState('');
  const [approvalDesc, setApprovalDesc] = useState('');
  const [approvalUrl, setApprovalUrl] = useState('');
  
  const [resolutionNotes, setResolutionNotes] = useState('');

  // --- 1. FETCH PROJECT ---
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('active_projects').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
  });

  // --- 2. FETCH NOTES (FROM NEW TABLE: project_notes) ---
  const { data: notes = [] } = useQuery({
    queryKey: ['project_notes', id],
    queryFn: async () => {
        // Now using the dedicated table
        const { data, error } = await supabase
          .from('project_notes' as any)
          .select('*') 
          .eq('project_id', id)
          .order('created_at', { ascending: false });
        
        if (error) return [];
        return data;
    }
  });

  // --- 3. FETCH DOCUMENTS ---
  const { data: files = [] } = useQuery({
    queryKey: ['project_documents', id],
    queryFn: async () => {
        const { data, error } = await supabase
          .from('project_documents' as any)
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false });
        if (error) return [];
        return data;
    }
  });

  // --- NEW: FETCH DELIVERABLES ---
  const { data: deliverables = [] } = useQuery({
    queryKey: ['project_deliverables', id],
    queryFn: async () => {
        const { data, error } = await supabase.from('project_deliverables' as any).select('*').eq('project_id', id).order('created_at', { ascending: false });
        if (error) return [];
        return data;
    }
  });

  // --- NEW: FETCH APPROVALS ---
  const { data: approvals = [] } = useQuery({
    queryKey: ['project_approvals', id],
    queryFn: async () => {
        const { data, error } = await supabase.from('project_approvals' as any).select('*').eq('project_id', id).order('created_at', { ascending: false });
        if (error) return [];
        return data;
    }
  });

  // --- NEW: FETCH TICKETS ---
  const { data: tickets = [] } = useQuery({
    queryKey: ['client_tickets', id],
    queryFn: async () => {
        const { data, error } = await supabase.from('client_tickets' as any).select('*').eq('project_id', id).order('created_at', { ascending: false });
        if (error) return [];
        return data;
    }
  });

  // --- 4. MUTATION: UPDATE PROJECT ---
  const updateProjectMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from('active_projects').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setIsEditOpen(false);
      toast.success("Project updated");
    },
    onError: (err) => toast.error(err.message)
  });

  // --- 5. MUTATION: ADD NOTE (TO NEW TABLE) ---
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!noteInput.trim()) return;
      
      const { error } = await supabase.from('project_notes' as any).insert({ 
        project_id: id, 
        content: noteInput
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_notes'] });
      setNoteInput('');
      toast.success("Note added");
    },
    onError: (err) => toast.error(err.message)
  });

  // --- 6. MUTATION: DELETE NOTE (FROM NEW TABLE) ---
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
        const { error } = await supabase.from('project_notes' as any).delete().eq('id', noteId);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['project_notes'] });
        toast.success("Note deleted");
    }
  });

  // --- 7. MUTATION: UPLOAD FILE ---
  const uploadFileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      setUploading(true);
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('project-attachments').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      
      const { error: dbError } = await supabase.from('project_documents' as any).insert({
        project_id: id, 
        file_name: selectedFile.name, 
        file_path: filePath, 
        file_type: selectedFile.type,
        document_type: 'attachment'
      });
      
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_documents'] });
      setIsAddFileOpen(false);
      setSelectedFile(null);
      setUploading(false);
      toast.success("Document uploaded");
    },
    onError: (err) => {
      setUploading(false);
      toast.error(err.message);
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (file: any) => {
        await supabase.storage.from('project-attachments').remove([file.file_path]);
        const { error } = await supabase.from('project_documents' as any).delete().eq('id', file.id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['project_documents'] });
        toast.success("Document deleted");
    }
  });

  const uploadDeliverableMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      setUploading(true);
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `deliverables/${id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('project-attachments').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('project-attachments').getPublicUrl(filePath);
      
      const { error: dbError } = await supabase.from('project_deliverables' as any).insert({
        project_id: id, 
        title: selectedFile.name, 
        file_url: urlData.publicUrl,
      });
      
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_deliverables'] });
      setSelectedFile(null);
      setUploading(false);
      toast.success("Deliverable uploaded and sent to client.");
    },
    onError: (err) => { setUploading(false); toast.error(err.message); }
  });

  const requestApprovalMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('project_approvals' as any).insert({
        project_id: id, title: approvalTitle, description: approvalDesc, asset_url: approvalUrl
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_approvals'] });
      setApprovalTitle(''); setApprovalDesc(''); setApprovalUrl('');
      toast.success("Approval requested from client.");
    },
    onError: (err) => toast.error(err.message)
  });

  const resolveTicketMutation = useMutation({
    mutationFn: async ({ ticketId, notes }: { ticketId: string, notes: string }) => {
      const { error } = await supabase.from('client_tickets' as any).update({
        status: 'resolved', resolution_notes: notes
      }).eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_tickets'] });
      setResolutionNotes('');
      toast.success("Ticket resolved.");
    },
    onError: (err) => toast.error(err.message)
  });

  const handleDownload = async (filePath: string) => {
      const { data } = await supabase.storage.from('project-attachments').createSignedUrl(filePath, 60);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
      else toast.error("Could not generate link");
  };

  const getProgress = (stage: string) => {
    const idx = STAGES.indexOf(stage);
    return ((idx + 1) / STAGES.length) * 100;
  };

  const openEdit = () => {
    setEditForm({
      project_name: project.project_name,
      client_name: project.client_name,
      total_budget: project.total_budget,
      paid_amount: project.paid_amount,
      stage: project.stage,
      status: project.status,
      start_date: project.start_date,
      deadline: project.deadline
    });
    setIsEditOpen(true);
  };

  if (isLoading) return <DashboardLayout><div className="p-8">Loading...</div></DashboardLayout>;
  if (!project) return <DashboardLayout><div className="p-8">Project not found.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{project.project_name}</h1>
                <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="uppercase text-xs">
                  {project.status}
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <Building className="h-4 w-4" /> {project.client_name} 
                <span className="text-gray-300">|</span>
                <span className="capitalize text-primary">{project.stage}</span> Stage
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={openEdit}>
            <Edit className="h-4 w-4 mr-2" /> Edit Project
          </Button>
        </div>

        {/* PROGRESS BAR */}
        <div className="bg-white p-1 rounded-full shadow-sm">
            <div className="h-3 bg-muted rounded-full overflow-hidden w-full">
                <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-1000 ease-out" 
                    style={{ width: `${getProgress(project.stage)}%` }} 
                />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: MAIN CONTENT */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* STATS */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Total Budget</p>
                        <p className="text-2xl font-bold">{formatCurrency(project.total_budget)}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Paid Amount</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(project.paid_amount)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {((project.paid_amount / project.total_budget) * 100).toFixed(0)}% Settled
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* TABS */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-6 h-auto p-1">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                <TabsTrigger value="approvals">Approvals</TabsTrigger>
                <TabsTrigger value="tickets">Tickets</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-4">
                <Card>
                  <CardHeader><CardTitle>Launch Checklist</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                        {['domain_purchased', 'ssl_active', 'credentials_sent', 'retainer_paid'].map((field) => (
                            <div key={field} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <Checkbox 
                                    id={field} 
                                    checked={project[field] || false}
                                    onCheckedChange={(checked) => updateProjectMutation.mutate({ [field]: checked })}
                                />
                                <label htmlFor={field} className="text-sm font-medium capitalize cursor-pointer flex-1">
                                    {field.replace('_', ' ')}
                                </label>
                                {project[field] && <CheckSquare className="h-4 w-4 text-green-500" />}
                            </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <Card>
                  <CardHeader><CardTitle>Project Updates</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex gap-4">
                      <Textarea placeholder="Add a project update..." value={noteInput} onChange={(e) => setNoteInput(e.target.value)} className="min-h-[80px]" />
                      <Button className="h-auto" onClick={() => addNoteMutation.mutate()} disabled={addNoteMutation.isPending}><Send className="h-4 w-4" /></Button>
                    </div>
                    <div className="space-y-4">
                      {notes.length === 0 ? <p className="text-center text-muted-foreground py-4">No notes yet.</p> : notes.map((note: any) => (
                        <div key={note.id} className="flex gap-4 group items-start border-b pb-4 last:border-0">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1"><Activity className="h-4 w-4 text-blue-600" /></div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-xs text-muted-foreground">{format(new Date(note.created_at), 'MMM d, h:mm a')}</p>
                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteNoteMutation.mutate(note.id)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                            <p className="text-sm text-gray-800 bg-muted/50 p-3 rounded-lg rounded-tl-none">{note.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="files" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Files & Assets</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setIsAddFileOpen(true)}><Paperclip className="h-4 w-4 mr-2" /> Upload</Button>
                  </CardHeader>
                  <CardContent>
                    {files.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed rounded-lg">
                            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">No files attached.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {files.map((file: any) => (
                                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 rounded"><FileText className="h-5 w-5 text-blue-600" /></div>
                                        <div>
                                            <p className="font-medium text-sm">{file.file_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {file.uploaded_at ? format(new Date(file.uploaded_at), 'MMM d') : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleDownload(file.file_path)}>
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => deleteFileMutation.mutate(file)}>
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

              <TabsContent value="deliverables" className="mt-4 space-y-4">
                <Card>
                  <CardHeader><CardTitle>Project Deliverables Vault</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <Label>Upload Final File for Client</Label>
                        <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                      </div>
                      <Button onClick={() => uploadDeliverableMutation.mutate()} disabled={!selectedFile || uploading}>
                        {uploading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                        Upload & Share
                      </Button>
                    </div>
                    <div className="space-y-2 mt-4">
                      {deliverables.map((d: any) => (
                        <div key={d.id} className="flex justify-between items-center p-3 border rounded-lg bg-muted/20">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-green-600" />
                            <div><p className="font-medium text-sm">{d.title}</p><p className="text-xs text-muted-foreground">{format(new Date(d.created_at), 'PPP')}</p></div>
                          </div>
                          <Button variant="outline" size="sm" asChild><a href={d.file_url} target="_blank" rel="noreferrer">Download</a></Button>
                        </div>
                      ))}
                      {deliverables.length === 0 && <p className="text-sm text-muted-foreground">No deliverables shared with client yet.</p>}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="approvals" className="mt-4 space-y-4">
                <Card>
                  <CardHeader><CardTitle>Request Client Approval</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="col-span-2"><Label>Title (e.g. Homepage Wireframes)</Label><Input value={approvalTitle} onChange={e => setApprovalTitle(e.target.value)} /></div>
                      <div className="col-span-2"><Label>Description / Instructions</Label><Textarea value={approvalDesc} onChange={e => setApprovalDesc(e.target.value)} /></div>
                      <div className="col-span-2"><Label>Figma / Asset Link (Optional)</Label><Input value={approvalUrl} onChange={e => setApprovalUrl(e.target.value)} /></div>
                    </div>
                    <Button onClick={() => requestApprovalMutation.mutate()} disabled={!approvalTitle}><ThumbsUp className="h-4 w-4 mr-2" />Send Approval Request</Button>
                  </CardContent>
                </Card>
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg mt-6">Pending & Past Approvals</h3>
                  {approvals.map((a: any) => (
                    <Card key={a.id}>
                      <CardContent className="p-4 flex justify-between items-start">
                        <div>
                          <h4 className="font-bold">{a.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                          {a.client_feedback && <p className="text-sm bg-muted/50 p-2 rounded mt-2 border-l-2 border-primary">Client Feedback: {a.client_feedback}</p>}
                        </div>
                        <Badge variant={a.status === 'approved' ? 'default' : a.status === 'changes_requested' ? 'destructive' : 'secondary'} className="capitalize">
                          {a.status.replace('_', ' ')}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="tickets" className="mt-4 space-y-4">
                <Card>
                  <CardHeader><CardTitle>Client Support Tickets</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {tickets.length === 0 ? <p className="text-muted-foreground">No active tickets for this project.</p> : null}
                    {tickets.map((t: any) => (
                      <div key={t.id} className="border p-4 rounded-lg bg-card">
                        <div className="flex justify-between mb-2">
                          <h4 className="font-bold flex items-center gap-2"><LifeBuoy className="h-4 w-4" /> {t.title}</h4>
                          <Badge variant={t.status === 'resolved' ? 'default' : 'destructive'} className="capitalize">{t.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.description}</p>
                        
                        {t.status !== 'resolved' && t.status !== 'closed' ? (
                          <div className="mt-4 flex gap-2">
                            <Input placeholder="Resolution notes..." value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} />
                            <Button size="sm" onClick={() => resolveTicketMutation.mutate({ ticketId: t.id, notes: resolutionNotes })}>Resolve</Button>
                          </div>
                        ) : (
                          <div className="mt-4 bg-green-50 text-green-800 p-3 rounded-lg text-sm">
                            <span className="font-bold">Resolution: </span>{t.resolution_notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT: SIDEBAR */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Start Date</span>
                    <span>{project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Deadline</span>
                    <span className={project.deadline ? "text-red-600 font-medium" : ""}>
                        {project.deadline ? format(new Date(project.deadline), 'MMM d, yyyy') : 'No Deadline'}
                    </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Client ID</span>
                    <span className="font-mono text-xs">{project.client_id ? project.client_id.slice(0,8) : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Project ID</span>
                    <span className="font-mono text-xs">{project.id.slice(0,8)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 text-white border-0">
                <CardContent className="p-6">
                    <h3 className="font-bold mb-1">Quick Actions</h3>
                    <p className="text-xs text-slate-400 mb-4">Common project management tasks.</p>
                    <div className="space-y-2">
                        <Button variant="secondary" className="w-full text-xs justify-start" onClick={() => updateProjectMutation.mutate({ credentials_sent: !project.credentials_sent })}>
                            <div className={`w-2 h-2 rounded-full mr-2 ${project.credentials_sent ? 'bg-green-500' : 'bg-red-500'}`} />
                            Toggle Credentials Sent
                        </Button>
                        <Button variant="secondary" className="w-full text-xs justify-start" onClick={() => updateProjectMutation.mutate({ retainer_paid: !project.retainer_paid })}>
                            <div className={`w-2 h-2 rounded-full mr-2 ${project.retainer_paid ? 'bg-green-500' : 'bg-red-500'}`} />
                            Toggle Retainer Paid
                        </Button>
                    </div>
                </CardContent>
            </Card>
          </div>

        </div>

        {/* --- EDIT DIALOG --- */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="col-span-2"><Label>Project Name</Label><Input value={editForm.project_name} onChange={e => setEditForm({...editForm, project_name: e.target.value})} /></div>
                    <div><Label>Client Name</Label><Input value={editForm.client_name} onChange={e => setEditForm({...editForm, client_name: e.target.value})} /></div>
                    <div><Label>Status</Label>
                        <Select value={editForm.status} onValueChange={val => setEditForm({...editForm, status: val})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div><Label>Budget</Label><Input type="number" value={editForm.total_budget} onChange={e => setEditForm({...editForm, total_budget: e.target.value})} /></div>
                    <div><Label>Paid</Label><Input type="number" value={editForm.paid_amount} onChange={e => setEditForm({...editForm, paid_amount: e.target.value})} /></div>
                    <div className="col-span-2">
                        <Label>Stage</Label>
                        <Select value={editForm.stage} onValueChange={val => setEditForm({...editForm, stage: val})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {STAGES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label>Start Date</Label><Input type="date" value={editForm.start_date || ''} onChange={e => setEditForm({...editForm, start_date: e.target.value})} /></div>
                    <div><Label>Deadline</Label><Input type="date" value={editForm.deadline || ''} onChange={e => setEditForm({...editForm, deadline: e.target.value})} /></div>
                </div>
                <DialogFooter><Button onClick={() => updateProjectMutation.mutate(editForm)}>Save Changes</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        {/* --- UPLOAD DIALOG --- */}
        <Dialog open={isAddFileOpen} onOpenChange={setIsAddFileOpen}>
            <DialogContent>
                <DialogHeader><DialogTitle>Upload File</DialogTitle></DialogHeader>
                <div className="py-4 space-y-4">
                    <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                    {selectedFile && <p className="text-xs text-green-600">{selectedFile.name}</p>}
                </div>
                <DialogFooter>
                    <Button onClick={() => uploadFileMutation.mutate()} disabled={!selectedFile || uploading}>
                        {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}