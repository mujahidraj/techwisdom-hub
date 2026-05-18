/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import {
  ArrowLeft, Building, Calendar, DollarSign, CheckSquare,
  MessageSquare, Send, Edit, FileText, Paperclip, Download,
  Loader2, Trash2, X, Activity, LifeBuoy, ThumbsUp, UploadCloud,
  CheckCircle2, Clock, ShieldCheck, Zap,
  AlertCircle
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useNotifications, sendNotificationDirect } from '@/hooks/useNotifications';

const STAGES = [
  'discovery', 'requirement', 'strategy', 'design',
  'development', 'qa', 'deployment', 'maintenance'
];

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const { logActivity, logSecurity } = useActivityLog();
  const { sendNotification } = useNotifications();

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

  // --- 0. CHECK SECURITY ASSIGNMENT FOR EMPLOYEES ---
  const { data: isAssigned = false, isLoading: checkingAssignment } = useQuery({
    queryKey: ['project-assignment-check', id, user?.id, role],
    queryFn: async () => {
      if (!role) return false;
      if (role === 'admin') return true; // Admin has full bypass
      
      // Clients bypass for their own projects
      if (role === 'client') {
        const { data: proj } = await supabase.from('active_projects').select('client_id').eq('id', id!).maybeSingle();
        return proj?.client_id === user?.id;
      }
      
      if (role === 'employee') {
        const { data: empRecord } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (!empRecord) return false;

        const { data: assignment } = await (supabase
          .from('project_assignments' as any)
          .select('id')
          .eq('project_id', id!)
          .eq('employee_id', empRecord.id)
          .maybeSingle() as any);

        return !!assignment;
      }
      
      return false;
    },
    enabled: !!id && !!user?.id && !!role,
  });

  // --- FETCH ASSIGNED EMPLOYEES ---
  const { data: assignedEmployees = [] } = useQuery({
    queryKey: ['project_assigned_employees', id],
    queryFn: async () => {
      try {
        const { data: assignments, error: err } = await (supabase
          .from('project_assignments' as any)
          .select('employee_id')
          .eq('project_id', id!) as any);
          
        if (err) return [];
        if (!assignments || assignments.length === 0) return [];
        
        const empIds = assignments.map((a: any) => a.employee_id);
        
        const { data: emps, error: empErr } = await supabase.from('employees').select('id, designation, user_id').in('id', empIds);
        const { data: profs, error: profErr } = await supabase.from('profiles').select('user_id, full_name, avatar_url');
        
        if (empErr || profErr) return [];
        
        return emps.map(emp => {
          const profile = profs.find(p => p.user_id === emp.user_id);
          return {
            id: emp.id,
            designation: emp.designation,
            full_name: profile?.full_name || 'Unnamed Employee',
            avatar_url: profile?.avatar_url
          };
        });
      } catch (e) {
        console.error('Error fetching assigned employees:', e);
        return [];
      }
    },
    enabled: !!id
  });

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  // Fetch all employees in the system
  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees-list-details'],
    queryFn: async () => {
      const { data: emps, error: empErr } = await supabase.from('employees').select('id, designation, user_id');
      const { data: profs, error: profErr } = await supabase.from('profiles').select('user_id, full_name, avatar_url');
      if (empErr || profErr) throw empErr || profErr;

      return emps.map(emp => {
        const profile = profs.find(p => p.user_id === emp.user_id);
        return {
          id: emp.id,
          user_id: emp.user_id,
          designation: emp.designation,
          full_name: profile?.full_name || 'Unnamed Employee',
          avatar_url: profile?.avatar_url
        };
      });
    },
    enabled: !!id,
  });

  // --- 1. FETCH PROJECT ---
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('active_projects').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    }
  });

  // --- 2. FETCH NOTES ---
  const { data: notes = [] } = useQuery({
    queryKey: ['project_notes', id],
    queryFn: async () => {
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
      // Filter out selectedEmps from project updates payload
      const { selectedEmps, ...projectUpdates } = updates;
      
      const { error } = await supabase.from('active_projects').update(projectUpdates).eq('id', id);
      if (error) throw error;

      if (selectedEmps) {
        // Delete old assignments
        const { error: deleteError } = await (supabase
          .from('project_assignments' as any)
          .delete()
          .eq('project_id', id!) as any);

        if (deleteError) throw deleteError;

        // Insert new assignments
        if (selectedEmps.length > 0) {
          const assignments = selectedEmps.map((empId: string) => ({
            project_id: id!,
            employee_id: empId
          }));
          const { error: assignError } = await (supabase
            .from('project_assignments' as any)
            .insert(assignments) as any);
          
          if (assignError) throw assignError;
        }
      }
    },
    onSuccess: (data, variables) => {
      if (project) {
        if (variables.selectedEmps) {
          // Compute assignment delta for more detailed security logging
          const prevIds = (assignedEmployees || []).map((e: any) => e.id);
          const newIds = variables.selectedEmps || [];
          const added = newIds.filter((nid: string) => !prevIds.includes(nid));
          const removed = prevIds.filter((pid: string) => !newIds.includes(pid));

          if (added.length > 0 || removed.length > 0) {
            logActivity('assigned', 'project', `Modified employee assignments for ${project.project_name}`, id, { added, removed });
            logSecurity('UPDATE', 'PROJECT_ASSIGNMENT', `Modified employee assignments for project ${project.project_name}`, id, { added, removed });
          }

          // Notify newly assigned employees only
          if (added.length > 0) {
            const assignedEmps = allEmployees.filter((emp: any) => added.includes(emp.id));
            assignedEmps.forEach((emp: any) => {
              if (emp.user_id) {
                sendNotificationDirect({
                  targetRoles: [],
                  userId: emp.user_id,
                  title: '💼 New Project Assignment',
                  message: `You have been assigned to the project "${project.project_name}".`,
                  type: 'info',
                  actionLink: `/employee-portal`
                }).catch(err => console.error('notify assign error:', err));
              }
            });
          }
        }
        if (variables.stage) {
          logActivity('updated', 'project', `${project.project_name} to ${variables.stage} Stage`, id, { stage: variables.stage });
          logSecurity('UPDATE', 'PROJECT', `Changed project stage of ${project.project_name} to ${variables.stage}`, id);
          
          // Notify client
          if (project.client_id) {
            sendNotification({
              userId: project.client_id,
              title: '📈 Project Stage Updated',
              message: `Your project "${project.project_name}" has transitioned to the "${variables.stage.toUpperCase()}" stage.`,
              type: 'info',
              actionLink: `/client-portal?project=${id}&tab=overview`
            });
          }
        } else if (!variables.selectedEmps) {
          logActivity('updated', 'project', project.project_name, id, variables);
          logSecurity('UPDATE', 'PROJECT', `Updated project ${project.project_name}`, id);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project_assigned_employees', id] });
      setIsEditOpen(false);
      toast.success("Project updated");
    },
    onError: (err) => toast.error(err.message)
  });

  // --- 5. MUTATION: ADD NOTE ---
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
      if (project) {
        logActivity('commented', 'project', `Update on ${project.project_name}`, id);
      }
      queryClient.invalidateQueries({ queryKey: ['project_notes'] });
      setNoteInput('');
      toast.success("Note added");
    },
    onError: (err) => toast.error(err.message)
  });

  // --- 6. MUTATION: DELETE NOTE ---
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from('project_notes' as any).delete().eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (project) {
        logActivity('deleted', 'project', `Update from ${project.project_name}`, id);
      }
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
      if (project && selectedFile) {
        logActivity('submitted', 'project', `File "${selectedFile.name}" on ${project.project_name}`, id);
      }
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
    onSuccess: (data, file) => {
      if (project && file) {
        logActivity('deleted', 'project', `File "${file.file_name}" from ${project.project_name}`, id);
      }
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
    onSuccess: async () => {
      if (project?.client_id) {
        await sendNotification({
          userId: project.client_id,
          title: '📦 New Deliverable Uploaded',
          message: `A new deliverable "${selectedFile?.name || 'Asset'}" has been uploaded for your project "${project.project_name}".`,
          type: 'success',
          actionLink: `/client-portal?project=${id}&tab=deliverables`
        });
      }
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
    onSuccess: async () => {
      if (project?.client_id) {
        await sendNotification({
          userId: project.client_id,
          title: '⚖️ Approval Requested',
          message: `Your approval is requested for "${approvalTitle}" under project "${project.project_name}".`,
          type: 'warning',
          actionLink: `/client-portal?project=${id}&tab=approvals`
        });
      }
      queryClient.invalidateQueries({ queryKey: ['project_approvals'] });
      setApprovalTitle(''); setApprovalDesc(''); setApprovalUrl('');
      toast.success("Approval requested from client.");
    },
    onError: (err) => toast.error(err.message)
  });

  const resolveTicketMutation = useMutation({
    mutationFn: async ({ ticketId, notes, clientId, ticketTitle }: { ticketId: string, notes: string, clientId?: string, ticketTitle?: string }) => {
      const { error } = await supabase.from('client_tickets' as any).update({
        status: 'resolved', resolution_notes: notes
      }).eq('id', ticketId);
      if (error) throw error;
      return { clientId, ticketTitle };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['client_tickets'] });
      setResolutionNotes('');
      if (data?.clientId) {
        await sendNotification({
          userId: data.clientId,
          title: '✅ Support Ticket Resolved',
          message: `Your ticket "${data.ticketTitle || 'Support Request'}" has been successfully resolved.`,
          type: 'success',
          actionLink: `/client-portal?project=${id}&tab=tickets`
        });
      }
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
    setSelectedEmployees(assignedEmployees.map((emp: any) => emp.id));
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

  if (isLoading || checkingAssignment) {
    return (
      <DashboardLayout>
        <div className="flex h-[400px] items-center justify-center bg-white dark:bg-slate-950">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Retrieving Project Details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (role === 'employee' && !isAssigned) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
          <AlertCircle className="h-16 w-16 text-destructive mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            You are not assigned to this project. Please contact an administrator if you believe this is an error.
          </p>
          <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="flex h-[400px] items-center justify-center text-center">
          <div>
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold">Project Not Found</h2>
            <Button className="mt-4" onClick={() => navigate('/projects')}>Return to Projects</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const progressPercent = getProgress(project.stage);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in pb-10">

        {/* PREMIUM HEADER WITH BACK BUTTON */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/projects')}
              className="h-10 w-10 shrink-0 rounded-xl border-border/60 hover:bg-muted/50"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                  {project.project_name}
                </h1>
                <Badge className={`uppercase text-[10px] tracking-wider px-2 py-0.5 font-bold rounded-lg border-0 ${project.status === 'active' ? 'bg-indigo-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {project.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1.5 flex-wrap font-medium">
                <Building className="h-3.5 w-3.5 text-indigo-500" /> <span className="text-slate-700 dark:text-slate-300 font-bold">{project.client_name}</span>
                <span className="text-border">|</span>
                {(role === 'admin' || role === 'employee') ? (
                  <Select
                    value={project.stage}
                    onValueChange={(val) => updateProjectMutation.mutate({ stage: val })}
                  >
                    <SelectTrigger className="w-[130px] h-7 text-[10px] rounded-lg border-indigo-200/50 bg-indigo-50/40 dark:bg-indigo-950/10 font-bold text-indigo-600 dark:text-indigo-400 focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs capitalize py-1.5">
                          {s} Stage
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="capitalize text-[10px] rounded-md font-semibold border-indigo-200 text-indigo-600 bg-indigo-50/55 dark:bg-indigo-950/20">{project.stage} Stage</Badge>
                )}
              </div>
            </div>
          </div>

          {role === 'admin' && (
            <Button
              variant="outline"
              onClick={openEdit}
              className="h-9 rounded-xl text-xs gap-2 border-border/60 hover:bg-muted/50 w-full sm:w-auto self-stretch lg:self-auto shrink-0 justify-center"
            >
              <Edit className="h-3.5 w-3.5" /> Edit Parameters
            </Button>
          )}
        </div>

        {/* PROGRESS METERS */}
        <div className="p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-border/40 rounded-2xl shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
            <span className="uppercase tracking-wider text-[10px] text-muted-foreground">Workflow Milestone Tracker</span>
            <span>{Math.round(progressPercent)}% Pipeline Completed</span>
          </div>
          <div className="h-3 bg-muted dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-border/10">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT PANEL: MAIN TABS & FINANCIALS */}
          <div className="lg:col-span-2 space-y-6">

            {/* STATS MATRIX */}
            {role !== 'employee' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="glass-card hover:shadow-md transition-shadow relative overflow-hidden border-l-4 border-l-indigo-500">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Statement Budget</p>
                        <p className="text-2xl font-black mt-1.5 tracking-tight">{formatCurrency(project.total_budget)}</p>
                      </div>
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-500">
                        <DollarSign className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card hover:shadow-md transition-shadow relative overflow-hidden border-l-4 border-l-emerald-500">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Cleared Receipts</p>
                        <p className="text-2xl font-black mt-1.5 text-emerald-600 tracking-tight">{formatCurrency(project.paid_amount)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5 font-bold">
                          {((project.paid_amount / project.total_budget) * 100).toFixed(0)}% of total contract settled
                        </p>
                      </div>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-500">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB CONTAINER */}
            <Tabs defaultValue="overview" className="w-full">
              {/* Responsive scrollbar horizontal tabs */}
              <TabsList className="flex overflow-x-auto w-full max-w-full justify-start items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl sidebar-scroll">
                <TabsTrigger value="overview" className="rounded-lg text-xs py-1.5 px-3 shrink-0">Launch List</TabsTrigger>
                <TabsTrigger value="notes" className="rounded-lg text-xs py-1.5 px-3 shrink-0">Updates & Notes</TabsTrigger>
                <TabsTrigger value="files" className="rounded-lg text-xs py-1.5 px-3 shrink-0">Repository</TabsTrigger>
                <TabsTrigger value="deliverables" className="rounded-lg text-xs py-1.5 px-3 shrink-0">Deliverables</TabsTrigger>
                <TabsTrigger value="approvals" className="rounded-lg text-xs py-1.5 px-3 shrink-0">Client Approvals</TabsTrigger>
                <TabsTrigger value="tickets" className="rounded-lg text-xs py-1.5 px-3 shrink-0">Tickets</TabsTrigger>
              </TabsList>

              {/* TABS CONTENT: OVERVIEW */}
              <TabsContent value="overview" className="mt-4 focus-visible:outline-none">
                <Card className="glass-card">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-indigo-500" />
                      Production Launch Checklist
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {['domain_purchased', 'ssl_active', 'credentials_sent', 'retainer_paid'].map((field) => (
                        <div key={field} className="flex items-center space-x-3 p-3.5 bg-muted/20 border border-border/30 rounded-xl hover:bg-muted/40 transition-colors">
                          <Checkbox
                            id={`tab-field-${field}`}
                            checked={project[field] || false}
                            onCheckedChange={(checked) => updateProjectMutation.mutate({ [field]: checked })}
                            className="rounded h-4 w-4"
                          />
                          <label htmlFor={`tab-field-${field}`} className="text-xs font-semibold capitalize cursor-pointer flex-1 text-slate-800 dark:text-slate-200">
                            {field.replace('_', ' ')}
                          </label>
                          {project[field] && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TABS CONTENT: NOTES */}
              <TabsContent value="notes" className="mt-4 focus-visible:outline-none">
                <Card className="glass-card">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-indigo-500" />
                      Project Updates Ledger
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-5">
                    <div className="flex gap-2.5 items-start">
                      <Textarea
                        placeholder="Type project update or action taken..."
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        className="min-h-[80px] bg-muted/20 text-xs rounded-xl"
                      />
                      <Button
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-xl gradient-primary shadow-sm"
                        onClick={() => addNoteMutation.mutate()}
                        disabled={addNoteMutation.isPending || !noteInput.trim()}
                      >
                        <Send className="h-4 w-4 text-white" />
                      </Button>
                    </div>

                    <div className="space-y-3 mt-4 max-h-[350px] overflow-y-auto sidebar-scroll pr-1">
                      {notes.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-6">No historical notes uploaded yet.</p>
                      ) : notes.map((note: any) => (
                        <div key={note.id} className="flex gap-3 group items-start p-3 bg-muted/20 rounded-xl border border-border/10">
                          <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0 mt-0.5">
                            <Activity className="h-3.5 w-3.5 text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-[10px] text-muted-foreground font-semibold">
                                {format(new Date(note.created_at), 'MMM d, yyyy • h:mm a')}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive rounded-lg hover:bg-destructive/10"
                                onClick={() => deleteNoteMutation.mutate(note.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TABS CONTENT: FILES */}
              <TabsContent value="files" className="mt-4 focus-visible:outline-none">
                <Card className="glass-card">
                  <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between gap-4">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-indigo-500" />
                      Document Repositories
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddFileOpen(true)}
                      className="h-8 rounded-xl text-xs gap-1.5 border-border/60"
                    >
                      <UploadCloud className="h-3.5 w-3.5" /> Upload File
                    </Button>
                  </CardHeader>
                  <CardContent className="p-5 pt-0">
                    {files.length === 0 ? (
                      <div className="text-center py-10 border border-dashed rounded-xl border-border/50">
                        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                        <p className="text-xs text-muted-foreground font-medium">No attachments uploaded yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto sidebar-scroll pr-1">
                        {files.map((file: any) => (
                          <div key={file.id} className="flex items-center justify-between p-3 border rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors group border-border/40 gap-2">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-lg shrink-0">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate leading-snug" title={file.file_name}>
                                  {file.file_name}
                                </p>
                                <span className="text-[9px] text-muted-foreground font-medium">
                                  {file.uploaded_at ? format(new Date(file.uploaded_at), 'MMM d, yyyy') : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-muted-foreground"
                                onClick={() => handleDownload(file.file_path)}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                                onClick={() => deleteFileMutation.mutate(file)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TABS CONTENT: DELIVERABLES */}
              <TabsContent value="deliverables" className="mt-4 focus-visible:outline-none">
                <Card className="glass-card">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                      Client Deliverables Vault
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-5">
                    <div className="flex flex-col sm:flex-row gap-3 items-end p-4 bg-muted/20 border border-border/30 rounded-xl">
                      <div className="flex-1 w-full">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Upload final asset to client</Label>
                        <Input
                          type="file"
                          onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                          className="mt-1.5 h-9 bg-background/50 border-border/40 text-xs rounded-xl"
                        />
                      </div>
                      <Button
                        onClick={() => uploadDeliverableMutation.mutate()}
                        disabled={!selectedFile || uploading}
                        className="h-9 text-xs rounded-xl gap-1.5 w-full sm:w-auto shrink-0"
                      >
                        {uploading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <UploadCloud className="h-3.5 w-3.5" />}
                        Share deliverable
                      </Button>
                    </div>

                    <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto sidebar-scroll pr-1">
                      {deliverables.map((d: any) => (
                        <div key={d.id} className="flex justify-between items-center p-3 border border-border/20 rounded-xl bg-muted/10 gap-2">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg shrink-0">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate leading-snug" title={d.title}>{d.title}</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">{format(new Date(d.created_at), 'PPP')}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-lg shrink-0 border-border/40 bg-white" asChild>
                            <a href={d.file_url} target="_blank" rel="noreferrer">Download</a>
                          </Button>
                        </div>
                      ))}
                      {deliverables.length === 0 && (
                        <p className="text-center text-xs text-muted-foreground py-6">No assets share logs found.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TABS CONTENT: APPROVALS */}
              <TabsContent value="approvals" className="mt-4 focus-visible:outline-none space-y-5">
                <Card className="glass-card">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-indigo-500" />
                      Initiate Client Approval Request
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Request Asset Title</Label>
                        <Input placeholder="e.g. Design Wireframes V2" value={approvalTitle} onChange={e => setApprovalTitle(e.target.value)} className="mt-1 bg-muted/20 border-border/40 text-xs rounded-xl" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Description & Action Items</Label>
                        <Textarea placeholder="Describe asset details and items clients need to verify..." value={approvalDesc} onChange={e => setApprovalDesc(e.target.value)} className="mt-1 bg-muted/20 border-border/40 text-xs rounded-xl min-h-[70px]" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Asset Figma / Public URL</Label>
                        <Input placeholder="https://figma.com/file/..." value={approvalUrl} onChange={e => setApprovalUrl(e.target.value)} className="mt-1 bg-muted/20 border-border/40 text-xs rounded-xl" />
                      </div>
                    </div>
                    <Button
                      onClick={() => requestApprovalMutation.mutate()}
                      disabled={!approvalTitle}
                      className="gradient-primary text-xs rounded-xl gap-1.5 h-9 mt-2"
                    >
                      <ThumbsUp className="h-3.5 w-3.5 text-white" /> Request Approval
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Request Approvals Audit Log
                  </h3>

                  {approvals.length === 0 ? (
                    <Card className="glass-card"><CardContent className="p-6 text-center text-xs text-muted-foreground">No approval requests made yet.</CardContent></Card>
                  ) : approvals.map((a: any) => (
                    <Card key={a.id} className="glass-card hover:shadow-md transition-all border-border/40">
                      <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1 flex-1">
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">{a.title}</h4>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{a.description}</p>
                          {a.client_feedback && (
                            <p className="text-[11px] bg-muted/50 p-2.5 rounded-xl mt-2 border-l-2 border-primary text-slate-700 dark:text-slate-300">
                              <span className="font-bold">Feedback:</span> {a.client_feedback}
                            </p>
                          )}
                        </div>
                        <Badge className={`capitalize text-[9px] px-2 py-0.5 rounded-lg border-0 shrink-0 font-bold ${a.status === 'approved' ? 'bg-emerald-500 text-white' : a.status === 'changes_requested' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                          {a.status.replace('_', ' ')}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* TABS CONTENT: TICKETS */}
              <TabsContent value="tickets" className="mt-4 focus-visible:outline-none space-y-4">
                <Card className="glass-card">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <LifeBuoy className="h-4 w-4 text-indigo-500" />
                      Client Operations Tickets
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-4">
                    {tickets.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-6">No support tickets generated for this project.</p>
                    )}

                    {tickets.map((t: any) => (
                      <div key={t.id} className="border border-border/30 p-4 rounded-2xl bg-card hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                          <h4 className="font-bold text-xs flex items-center gap-1.5"><LifeBuoy className="h-3.5 w-3.5 text-indigo-500" /> {t.title}</h4>
                          <Badge className={`capitalize text-[9px] px-1.5 py-0.5 rounded-md border-0 font-bold ${t.status === 'resolved' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{t.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{t.description}</p>

                        {t.status !== 'resolved' && t.status !== 'closed' ? (
                          <div className="mt-4 flex gap-2 w-full">
                            <Input placeholder="Type resolution summaries..." value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} className="h-8 text-xs bg-muted/20 border-border/40 rounded-lg flex-1" />
                            <Button size="sm" className="h-8 text-[10px] rounded-lg shrink-0" onClick={() => resolveTicketMutation.mutate({ ticketId: t.id, notes: resolutionNotes, clientId: t.client_id, ticketTitle: t.title })}>Resolve</Button>
                          </div>
                        ) : (
                          <div className="mt-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 p-3 rounded-xl text-xs border border-emerald-100 dark:border-emerald-900/40">
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

          {/* RIGHT SIDEBAR: METADATA & QUICK ACTIONS */}
          <div className="space-y-6">

            {/* METADATA CARD */}
            <Card className="glass-card border-border/40">
              <CardHeader className="p-5 pb-2"><CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground">Audit Parameters</CardTitle></CardHeader>
              <CardContent className="p-5 pt-0 space-y-3.5 text-xs">
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-indigo-500" /> Start Date</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-pink-500" /> Deadline</span>
                  <span className={project.deadline ? "text-red-500 font-bold" : "text-slate-600 dark:text-slate-400 font-bold"}>
                    {project.deadline ? format(new Date(project.deadline), 'MMM d, yyyy') : 'No Deadline'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1"><Building className="h-3.5 w-3.5 text-slate-500" /> Client Ref</span>
                  <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400">{project.client_id ? project.client_id.slice(0, 8) : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-slate-500" /> Project UID</span>
                  <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400">{project.id.slice(0, 8)}</span>
                </div>
              </CardContent>
            </Card>

            {/* ASSIGNED TEAM MEMBERS */}
            <Card className="glass-card border-border/40">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-500" /> Assigned Team ({assignedEmployees.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3.5">
                {assignedEmployees.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 font-medium">No team members assigned yet.</p>
                ) : (
                  <div className="space-y-3">
                    {assignedEmployees.map((emp: any) => (
                      <div key={emp.id} className="flex items-center gap-3 p-2 bg-muted/20 rounded-xl hover:bg-muted/40 transition-colors">
                        <Avatar className="h-8 w-8 text-xs shrink-0">
                          <AvatarImage src={emp.avatar_url || ''} />
                          <AvatarFallback className="gradient-primary text-white text-[10px]">
                            {emp.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{emp.full_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{emp.designation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* QUICK ACTIONS CARD */}
            {role === 'admin' && (
              <Card className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border-0 shadow-xl overflow-hidden relative">
                <div className="absolute -top-10 -right-10 h-24 w-24 bg-white/5 rounded-full blur-2xl"></div>
                <CardContent className="p-6 relative z-10">
                  <h3 className="font-black text-sm uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-400" /> Administrative Operations
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Quick toggles for contract validation and handover details.</p>

                  <div className="space-y-3.5 mt-5">
                    <Button
                      variant="secondary"
                      className="w-full text-xs justify-start rounded-xl h-10 border-0 bg-white/10 text-white hover:bg-white/20 transition-all font-semibold"
                      onClick={() => updateProjectMutation.mutate({ credentials_sent: !project.credentials_sent })}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full mr-2.5 shrink-0 ${project.credentials_sent ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                      Credentials Handover
                    </Button>

                    <Button
                      variant="secondary"
                      className="w-full text-xs justify-start rounded-xl h-10 border-0 bg-white/10 text-white hover:bg-white/20 transition-all font-semibold"
                      onClick={() => updateProjectMutation.mutate({ retainer_paid: !project.retainer_paid })}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full mr-2.5 shrink-0 ${project.retainer_paid ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                      Maintenance Retainer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

        </div>

        {/* --- EDIT PARAMETERS DIALOG --- */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="rounded-2xl max-w-xl">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Edit Project details</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
              <div className="col-span-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Project Name</Label>
                <Input value={editForm.project_name} onChange={e => setEditForm({ ...editForm, project_name: e.target.value })} className="mt-1 rounded-xl text-xs bg-muted/20 border-border/40 h-9" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-muted-foreground">Client Business Name</Label>
                <Input value={editForm.client_name} onChange={e => setEditForm({ ...editForm, client_name: e.target.value })} className="mt-1 rounded-xl text-xs bg-muted/20 border-border/40 h-9" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-muted-foreground">Pipeline Status</Label>
                <Select value={editForm.status} onValueChange={val => setEditForm({ ...editForm, status: val })}>
                  <SelectTrigger className="mt-1 rounded-xl text-xs bg-muted/20 border-border/40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="active" className="text-xs">Active</SelectItem>
                    <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-muted-foreground">Statement Budget (৳)</Label>
                <Input type="number" value={editForm.total_budget} onChange={e => setEditForm({ ...editForm, total_budget: e.target.value })} className="mt-1 rounded-xl text-xs bg-muted/20 border-border/40 h-9" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-muted-foreground">Paid Amount (৳)</Label>
                <Input type="number" value={editForm.paid_amount} onChange={e => setEditForm({ ...editForm, paid_amount: e.target.value })} className="mt-1 rounded-xl text-xs bg-muted/20 border-border/40 h-9" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Current Stage</Label>
                <Select value={editForm.stage} onValueChange={val => setEditForm({ ...editForm, stage: val })}>
                  <SelectTrigger className="mt-1 rounded-xl text-xs bg-muted/20 border-border/40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {STAGES.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-muted-foreground">Start Date</Label>
                <Input type="date" value={editForm.start_date || ''} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} className="mt-1 rounded-xl text-xs bg-muted/20 border-border/40 h-9" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-muted-foreground">Deadline Date</Label>
                <Input type="date" value={editForm.deadline || ''} onChange={e => setEditForm({ ...editForm, deadline: e.target.value })} className="mt-1 rounded-xl text-xs bg-muted/20 border-border/40 h-9" />
              </div>
              {/* Assign Employees */}
              <div className="col-span-2 space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Assign Employees to Project</Label>
                <div className="border rounded-xl p-3 bg-muted/10 max-h-40 overflow-y-auto space-y-2.5">
                  {allEmployees.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1 font-medium">No employees found.</p>
                  ) : (
                    allEmployees.map((emp: any) => (
                      <div key={emp.id} className="flex items-center space-x-3 p-1 rounded-lg hover:bg-muted/30 transition-colors">
                        <Checkbox
                          id={`emp-edit-details-${emp.id}`}
                          checked={selectedEmployees.includes(emp.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedEmployees([...selectedEmployees, emp.id]);
                            } else {
                              setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                            }
                          }}
                          className="rounded h-4 w-4"
                        />
                        <Label htmlFor={`emp-edit-details-${emp.id}`} className="text-xs font-normal cursor-pointer flex-1 flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{emp.full_name}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{emp.designation}</span>
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={() => updateProjectMutation.mutate({ ...editForm, selectedEmps: selectedEmployees })} className="gradient-primary h-9 text-xs rounded-xl w-full sm:w-auto">Save Parameters</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- UPLOAD FILE DIALOG --- */}
        <Dialog open={isAddFileOpen} onOpenChange={setIsAddFileOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-indigo-500" /> Upload Repository Document</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="rounded-xl bg-muted/20 border-border/40 text-xs" />
              {selectedFile && <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckSquare className="h-3.5 w-3.5" /> Selected: {selectedFile.name}</p>}
            </div>
            <DialogFooter>
              <Button onClick={() => uploadFileMutation.mutate()} disabled={!selectedFile || uploading} className="gradient-primary h-9 text-xs rounded-xl w-full">
                {uploading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : 'Begin Upload'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}