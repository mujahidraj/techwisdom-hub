import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
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
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  StickyNote,
  ArrowLeft,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export default function Notes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [deleteNote, setDeleteNote] = useState<Note | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['notes', user?.id],
    queryFn: async () => {
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });
      if (notesError) throw notesError;

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');
      if (profilesError) throw profilesError;

      const profilesMap = new Map<string, { full_name: string | null; email: string | null }>();
      profilesData?.forEach((p) => {
        profilesMap.set(p.user_id, { full_name: p.full_name, email: p.email });
      });

      return {
        notes: notesData as Note[],
        profilesMap,
      };
    },
    enabled: !!user?.id,
  });

  const notes = data?.notes || [];
  const profilesMap = data?.profilesMap || new Map();

  const createMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      const { error } = await supabase.from('notes').insert({
        user_id: user?.id,
        title,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note created');
      setAddOpen(false);
      setTitle('');
      setContent('');
    },
    onError: (error: any) => {
      toast.error('Failed to create note: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: string }) => {
      const { error } = await supabase
        .from('notes')
        .update({ title, content })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note saved successfully');
      setEditNote(null);
      
      // Update selectedNote layout state
      if (selectedNote) {
        setSelectedNote({
          ...selectedNote,
          title,
          content,
          updated_at: new Date().toISOString()
        });
      }
    },
    onError: (error: any) => {
      toast.error('Failed to save note: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note deleted');
      setDeleteNote(null);
      if (selectedNote?.id === deleteNote?.id) {
        setSelectedNote(null);
        setTitle('');
        setContent('');
      }
    },
    onError: (error: any) => {
      toast.error('Failed to delete note: ' + error.message);
    },
  });

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(search.toLowerCase()) ||
      note.content?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    createMutation.mutate({ title, content });
  };

  const handleEdit = () => {
    if (!editNote || !title.trim()) {
      toast.error('Title is required');
      return;
    }
    updateMutation.mutate({ id: editNote.id, title, content });
  };

  const openEditDialog = (note: Note) => {
    setTitle(note.title);
    setContent(note.content || '');
    setEditNote(note);
  };

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content || '');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-10">
        
        {/* HEADER AREA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                <StickyNote className="h-5 w-5 text-white" />
              </div>
              Personal Repository
            </h1>
            <p className="text-muted-foreground mt-1.5 text-xs font-medium">
              Keep custom instructions, project requirements, scripts, and configurations organized.
            </p>
          </div>
          <Button 
            className="gradient-primary shadow-lg shadow-primary/20 h-9 rounded-xl text-xs" 
            onClick={() => {
              setTitle('');
              setContent('');
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Note
          </Button>
        </div>

        {/* SEARCH BAR (Visible only when list is displayed on mobile) */}
        <div className={`relative ${selectedNote ? 'hidden lg:block' : 'block'}`}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter note records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md text-xs rounded-xl border-border/40 shadow-sm"
          />
        </div>

        {/* BENTO MASTER-DETAIL VIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* ══════════════════ PANEL 1: NOTES LIST ══════════════════ */}
          <div className={`lg:col-span-1 space-y-2.5 ${selectedNote ? 'hidden lg:block' : 'block'}`}>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-[10px] text-muted-foreground font-black uppercase">Loading Notes Ledger...</p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-16 text-center">
                  <StickyNote className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {search ? 'No notes matched filter criteria' : 'Workspace database is completely empty.'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Create a note card to catalog your operations.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredNotes.map((note) => {
                  const profile = profilesMap.get(note.user_id);
                  const ownerName = profile?.full_name || profile?.email || 'System';
                  return (
                  <Card
                    key={note.id}
                    className={`cursor-pointer transition-all duration-200 border-border/40 hover:shadow-md relative overflow-hidden group ${
                      selectedNote?.id === note.id 
                        ? 'bg-slate-100/80 dark:bg-slate-800/80 border-indigo-400 dark:border-indigo-600 shadow-sm' 
                        : 'glass-card hover:bg-white/90 dark:hover:bg-slate-900/90'
                    }`}
                    onClick={() => handleSelectNote(note)}
                  >
                    {/* Visual left edge stripe */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${
                      selectedNote?.id === note.id ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-indigo-300'
                    }`} />

                    <CardContent className="p-4 pl-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {note.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-[9px] text-muted-foreground font-semibold flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(note.updated_at), 'MMM d, yyyy')}
                            </span>
                            <span>•</span>
                            <span>Owner: {ownerName}</span>
                          </div>
                        </div>

                        {/* Hover Delete Action */}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive rounded-lg hover:bg-destructive/10"
                            onClick={() => setDeleteNote(note)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      {note.content && (
                        <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                          {note.content}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )})}
              </div>
            )}
          </div>

          {/* ══════════════════ PANEL 2: TEXT EDITOR ══════════════════ */}
          <Card className={`glass-card lg:col-span-2 border-border/40 overflow-hidden min-h-[450px] flex flex-col ${
            selectedNote ? 'block' : 'hidden lg:flex'
          }`}>
            {selectedNote ? (
              <>
                <CardHeader className="p-5 pb-3 border-b border-border/30">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Back button on mobile only */}
                      <Button
                        variant="outline"
                        size="icon"
                        className="lg:hidden h-8 w-8 rounded-lg shrink-0 border-border/60"
                        onClick={() => setSelectedNote(null)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div className="min-w-0 flex-1">
                        <Label className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Note Title</Label>
                        <Input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Note Title"
                          className="h-8 text-sm font-bold bg-transparent border-0 border-b border-transparent focus-visible:border-indigo-500 rounded-none p-0 mt-0.5 focus-visible:ring-0 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        onClick={() => updateMutation.mutate({ id: selectedNote.id, title, content })}
                        disabled={updateMutation.isPending || !title.trim()}
                        size="sm"
                        className="h-8 text-xs rounded-xl gap-1.5 gradient-primary"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-5 flex-1 flex flex-col bg-white/30 dark:bg-slate-900/10">
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold mb-2.5 flex-wrap gap-2">
                    <span>Repository Text Editor (Owner: {profilesMap.get(selectedNote.user_id)?.full_name || profilesMap.get(selectedNote.user_id)?.email || 'System'})</span>
                    <span>Last updated: {format(new Date(selectedNote.updated_at), 'MMM d, yyyy • h:mm a')}</span>
                  </div>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Start drafting notes or configuration details here..."
                    className="flex-1 min-h-[320px] w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-xs sm:text-sm text-slate-800 dark:text-slate-200 resize-none font-mono"
                  />
                </CardContent>
              </>
            ) : (
              <CardContent className="p-6 flex-1 flex flex-col items-center justify-center text-center">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/45 text-indigo-500 rounded-2xl mb-4">
                  <FileText className="h-8 w-8 opacity-75" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Note Selected</p>
                <p className="text-[10px] text-muted-foreground mt-1 max-w-[240px]">
                  Select a repository card from the checklist sidebar to start editing custom notes instantly.
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* ══════════════════ DIALOG: ADD NOTE ══════════════════ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-indigo-500" /> Create New Note
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label className="text-xs font-bold uppercase text-muted-foreground">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Server Deployment Checklist"
                className="mt-1.5 h-9 bg-muted/20 border-border/40 text-xs rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase text-muted-foreground">Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your note markdown or script configurations..."
                rows={8}
                className="mt-1.5 bg-muted/20 border-border/40 text-xs rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} className="h-9 rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={createMutation.isPending}
              className="gradient-primary h-9 rounded-xl text-xs text-white"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ DIALOG: DELETE CONFIRMATION ══════════════════ */}
      <AlertDialog open={!!deleteNote} onOpenChange={(open) => !open && setDeleteNote(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Note Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs mt-2">
              Are you sure you want to delete the note "{deleteNote?.title}"? This action cannot be undone and will purge the data from the cloud storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl text-xs h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteNote && deleteMutation.mutate(deleteNote.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs h-9"
            >
              Delete Note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
