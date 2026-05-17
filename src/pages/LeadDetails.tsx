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
  ArrowLeft, Mail, Phone, Globe, Building, MapPin, Facebook, User,
  DollarSign, Tag, Clock, CheckCircle2, MessageSquare, Send, Briefcase, 
  Edit, FileText, Paperclip, Download, Loader2, Trash2, X
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // States
  const [noteTitle, setNoteTitle] = useState(''); // ADDED: Title State
  const [noteInput, setNoteInput] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // --- 1. FETCH LEAD DETAILS ---
  const { data: rawLead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
  });
  const lead = rawLead as any;

  // --- 2. FETCH NOTES (With Title) ---
  const { data: notes = [] } = useQuery({
    queryKey: ['lead_notes', id],
    queryFn: async () => {
        // Updated query to select 'title'
        const { data, error } = await supabase
          .from('notes' as any)
          .select('id, title, content, created_at') 
          .eq('lead_id', id)
          .order('created_at', { ascending: false });
        
        if (error) {
            console.error(error);
            return [];
        }
        return data;
    }
  });

  // --- 3. FETCH FILES ---
  const { data: files = [] } = useQuery({
    queryKey: ['lead_files', id],
    queryFn: async () => {
        const { data } = await supabase
          .from('lead_files' as any)
          .select('*')
          .eq('lead_id', id)
          .order('uploaded_at', { ascending: false });
        return data || [];
    }
  });

  // --- 4. MUTATION: EDIT LEAD ---
  const updateLeadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leads').update(editForm).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      setIsEditOpen(false);
      toast.success("Lead updated successfully");
    },
    onError: (err) => toast.error(err.message)
  });

  // --- 5. MUTATION: CHANGE STATUS ---
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
        const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['lead', id] });
        toast.success("Status updated");
    },
    onError: (err) => toast.error(err.message)
  });

  // --- 6. MUTATION: ADD NOTE (With Title Fix) ---
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!noteInput.trim()) return;
      
      const { error } = await supabase.from('notes' as any).insert({ 
        lead_id: id, 
        title: noteTitle || 'Note', // Send title (or default)
        content: noteInput 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_notes'] });
      setNoteInput('');
      setNoteTitle('');
      toast.success("Note added");
    },
    onError: (err) => toast.error("Failed to add note: " + err.message)
  });

  // --- 7. MUTATION: DELETE NOTE ---
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
        const { error } = await supabase.from('notes' as any).delete().eq('id', noteId);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['lead_notes'] });
        toast.success("Note deleted");
    },
    onError: (err) => toast.error("Failed to delete note: " + err.message)
  });

  // --- 8. MUTATION: UPLOAD FILE ---
  const uploadFileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      setUploading(true);
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('lead-attachments').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      
      const { error: dbError } = await supabase.from('lead_files' as any).insert({
        lead_id: id, file_name: selectedFile.name, file_path: filePath, file_size: selectedFile.size, file_type: selectedFile.type
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_files'] });
      setIsAddFileOpen(false);
      setSelectedFile(null);
      setUploading(false);
      toast.success("File uploaded");
    },
    onError: (err) => {
      setUploading(false);
      toast.error("Upload failed: " + err.message);
    }
  });

  // --- 9. MUTATION: DELETE FILE ---
  const deleteFileMutation = useMutation({
    mutationFn: async (file: any) => {
        await supabase.storage.from('lead-attachments').remove([file.file_path]);
        const { error } = await supabase.from('lead_files' as any).delete().eq('id', file.id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['lead_files'] });
        toast.success("File deleted");
    }
  });

  const handleDownload = async (filePath: string) => {
      const { data } = await supabase.storage.from('lead-attachments').createSignedUrl(filePath, 60);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
      else toast.error("Could not generate link");
  };

  const convertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('active_projects').insert({
        client_name: lead.business_name || lead.contact_person,
        project_name: `Project: ${lead.business_name}`,
        project_type: 'web_development',
        status: 'active',
        stage: 'discovery'
      });
      if (error) throw error;
      await supabase.from('leads').update({ status: 'deal_won' }).eq('id', id);
    },
    onSuccess: () => {
      toast.success("Converted to Project!");
      navigate('/projects');
    }
  });

  const openEdit = () => {
    setEditForm({
      business_name: lead.business_name, contact_person: lead.contact_person, email: lead.email,
      phone: lead.phone, category: lead.category, city: lead.city, address: lead.address,
      facebook_page: lead.facebook_page, website: lead.website, description: lead.description, status: lead.status
    });
    setIsEditOpen(true);
  };

  const openLink = (url: string) => {
    if (!url) return toast.error("Link not available");
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    window.open(finalUrl, '_blank');
  };

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'deal_won': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'deal_lost': return 'bg-red-100 text-red-700 border-red-200';
        case 'new': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'in_negotiation': return 'bg-purple-100 text-purple-700 border-purple-200';
        default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  if (isLoading) return <DashboardLayout><div className="p-8">Loading...</div></DashboardLayout>;
  if (!lead) return <DashboardLayout><div className="p-8">Lead not found.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/crm')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{lead.business_name || "Business Name"}</h1>
                
                {/* QUICK STATUS CHANGER */}
                <Select 
                    value={lead.status} 
                    onValueChange={(val) => updateStatusMutation.mutate(val)}
                >
                    <SelectTrigger className={`h-7 text-xs font-bold uppercase rounded-full px-3 w-auto border ${getStatusColor(lead.status)}`}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="in_negotiation">In Negotiation</SelectItem>
                        <SelectItem value="deal_won">Deal Won</SelectItem>
                        <SelectItem value="deal_lost">Deal Lost</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <User className="h-4 w-4" /> {lead.contact_person || 'No Contact Person'} 
                <span className="text-gray-300">|</span>
                <Clock className="h-4 w-4" /> Added {new Date(lead.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={openEdit}>
              <Edit className="h-4 w-4 mr-2" /> Edit Details
            </Button>
            {lead.status !== 'deal_won' && (
              <Button className="gradient-primary" onClick={() => convertMutation.mutate()}>
                <Briefcase className="h-4 w-4 mr-2" /> Convert to Project
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-green-50 border-green-100">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-full"><DollarSign className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <p className="text-xs text-green-600 font-bold uppercase">Category</p>
                    <p className="text-sm font-bold text-green-900 capitalize">{lead.category || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-100">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-full"><Tag className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <p className="text-xs text-blue-600 font-bold uppercase">Source</p>
                    <p className="text-sm font-bold text-blue-900">{lead.source || 'Direct'}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-purple-50 border-purple-100">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-full"><MapPin className="h-5 w-5 text-purple-600" /></div>
                  <div>
                    <p className="text-xs text-purple-600 font-bold uppercase">City</p>
                    <p className="text-sm font-bold text-purple-900">{lead.city || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
                <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-4">
                <Card>
                  <CardHeader><CardTitle>Business Information</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><span className="text-sm text-muted-foreground">Contact Person</span><p className="font-medium">{lead.contact_person}</p></div>
                      <div><span className="text-sm text-muted-foreground">Email</span><div className="flex items-center gap-2"><Mail className="h-4 w-4" /><p className="font-medium">{lead.email}</p></div></div>
                      <div><span className="text-sm text-muted-foreground">Phone</span><div className="flex items-center gap-2"><Phone className="h-4 w-4" /><p className="font-medium">{lead.phone || 'N/A'}</p></div></div>
                      <div><span className="text-sm text-muted-foreground">Address</span><p className="font-medium">{lead.address || 'N/A'}</p></div>
                      <div><span className="text-sm text-muted-foreground">Website</span><div className="flex items-center gap-2"><Globe className="h-4 w-4" /><a href={lead.website} target="_blank" className="font-medium text-blue-600">{lead.website || 'N/A'}</a></div></div>
                      <div><span className="text-sm text-muted-foreground">Facebook</span><div className="flex items-center gap-2"><Facebook className="h-4 w-4" /><a href={lead.facebook_page} target="_blank" className="font-medium text-blue-600">{lead.facebook_page ? 'View Page' : 'N/A'}</a></div></div>
                    </div>
                    <Separator />
                    <div><span className="text-sm text-muted-foreground">Description</span><p className="text-sm text-gray-700">{lead.description || "No description."}</p></div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <Card>
                  <CardHeader><CardTitle>Timeline & Notes</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    {/* Add Note Form */}
                    <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                      <Input 
                        placeholder="Note Title (Optional)" 
                        value={noteTitle} 
                        onChange={(e) => setNoteTitle(e.target.value)} 
                        className="bg-white"
                      />
                      <Textarea 
                        placeholder="Type a note..." 
                        value={noteInput} 
                        onChange={(e) => setNoteInput(e.target.value)} 
                        className="min-h-[80px] bg-white" 
                      />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => addNoteMutation.mutate()} disabled={addNoteMutation.isPending}>
                            <Send className="h-3 w-3 mr-2" /> Add Note
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {notes.length === 0 ? <p className="text-center text-muted-foreground py-4">No notes yet.</p> : notes.map((note: any) => (
                        <div key={note.id} className="flex gap-4 group items-start border-b pb-4 last:border-0">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1"><MessageSquare className="h-4 w-4 text-blue-600" /></div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <p className="font-semibold text-sm">{note.title || 'Note'}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(note.created_at), 'MMM d, h:mm a')}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteNoteMutation.mutate(note.id)}>
                                    <Trash2 className="h-3 w-3" />
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
                  <CardHeader className="flex flex-col md:flex-row items-center justify-between">
                    <CardTitle>Documents</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setIsAddFileOpen(true)}><Paperclip className="h-4 w-4 mr-2" /> Upload File</Button>
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
                                            <p className="text-xs text-muted-foreground">{(file.file_size / 1024).toFixed(1)} KB • {format(new Date(file.uploaded_at), 'MMM d')}</p>
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
            </Tabs>
          </div>

          {/* RIGHT COLUMN: CONTACT & SIDEBAR */}
          <div className="space-y-6">
            
            {/* QUICK CONTACT */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold mb-2">Quick Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="secondary" className="w-full text-xs" onClick={() => window.location.href = `tel:${lead.phone}`} disabled={!lead.phone}>
                        <Phone className="h-3 w-3 mr-2" /> Call
                    </Button>
                    <Button variant="secondary" className="w-full text-xs" onClick={() => window.location.href = `mailto:${lead.email}`} disabled={!lead.email}>
                        <Mail className="h-3 w-3 mr-2" /> Email
                    </Button>
                    <Button variant="secondary" className="w-full text-xs bg-green-600 hover:bg-green-700 text-white border-none" onClick={() => window.open(`https://wa.me/${lead.phone?.replace(/[^0-9]/g, '')}`, '_blank')} disabled={!lead.phone}>
                        <MessageSquare className="h-3 w-3 mr-2" /> WhatsApp
                    </Button>
                    <Button variant="secondary" className="w-full text-xs" onClick={() => openLink(lead.website)} disabled={!lead.website}>
                        <Globe className="h-3 w-3 mr-2" /> Website
                    </Button>
                </div>
                <Button variant="outline" className="w-full text-xs border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={() => openLink(lead.facebook_page)} disabled={!lead.facebook_page}>
                    <Facebook className="h-3 w-3 mr-2" /> Facebook Page
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">ID</span><span className="font-mono">{lead.id.slice(0,8)}</span></div>
                <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Created</span><span>{format(new Date(lead.created_at), 'MMM d, yyyy')}</span></div>
                <div className="flex justify-between py-2"><span className="text-muted-foreground">Status</span><span className="capitalize">{lead.status?.replace('_', ' ')}</span></div>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* --- EDIT DIALOG --- */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <div><Label>Business Name</Label><Input value={editForm.business_name} onChange={e => setEditForm({...editForm, business_name: e.target.value})} /></div>
                    <div><Label>Contact Person</Label><Input value={editForm.contact_person} onChange={e => setEditForm({...editForm, contact_person: e.target.value})} /></div>
                    <div><Label>Email</Label><Input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
                    <div><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
                    
                    <div><Label>Category</Label><Input value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} /></div>
                    <div><Label>City</Label><Input value={editForm.city} onChange={e => setEditForm({...editForm, city: e.target.value})} /></div>
                    
                    <div className="col-span-2"><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} /></div>
                    
                    <div><Label>Website</Label><Input value={editForm.website} onChange={e => setEditForm({...editForm, website: e.target.value})} /></div>
                    <div><Label>Facebook</Label><Input value={editForm.facebook_page} onChange={e => setEditForm({...editForm, facebook_page: e.target.value})} /></div>
                    
                    <div className="col-span-2"><Label>Description</Label><Textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} /></div>
                </div>
                <DialogFooter><Button onClick={() => updateLeadMutation.mutate()}>Save Changes</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        {/* --- ADD FILE DIALOG --- */}
        <Dialog open={isAddFileOpen} onOpenChange={setIsAddFileOpen}>
            <DialogContent>
                <DialogHeader><DialogTitle>Upload File</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label>Select Document/Image</Label>
                        <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                    </div>
                    {selectedFile && (
                        <p className="text-sm text-green-600">Selected: {selectedFile.name} ({(selectedFile.size/1024).toFixed(1)} KB)</p>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={() => uploadFileMutation.mutate()} disabled={!selectedFile || uploading}>
                        {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : 'Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}