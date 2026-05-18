/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import logo from '@/assets/techwisdom.png';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  LogOut,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Briefcase,
  Edit2,
  Save,
  X,
  CalendarDays,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Monitor,
  AlertTriangle,
  LifeBuoy,
  Megaphone,
  FileText,
  Package,
  Target,
  MessageSquare,
  Video,
  FolderKanban,
  Tag,
  Ticket,
  Check,
  Camera,
  Loader2,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Inbox
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { LeaveApplicationDialog } from '@/components/team/LeaveApplicationDialog';
import type { Tables } from '@/integrations/supabase/types';

const CLOUDINARY_CLOUD_NAME = "dljiukpd4";
const CLOUDINARY_PRESET = "chat_upload";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

type Employee = Tables<'employees'>;
type PayrollLog = Tables<'payroll_log'>;
type Profile = Tables<'profiles'>;

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  unpaid: 'Unpaid Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  other: 'Other',
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'text-amber-500 bg-amber-500/5' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-500/5' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-rose-600 bg-rose-500/5' },
  cancelled: { label: 'Cancelled', icon: X, color: 'text-slate-500 bg-slate-500/5' },
};

export default function EmployeePortal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role, signOut, loading } = useAuth();
  const { sendNotification } = useNotifications();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ full_name: '', phone: '', avatar_url: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketData, setTicketData] = useState({ title: '', description: '', category: 'software', priority: 'medium' });
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('projects');

  useEffect(() => {
    if (!loading && (!user || role !== 'employee')) {
      navigate('/auth');
    }
  }, [user, role, loading, navigate]);

  // QUERY: Profiles (Self-seeds if missing)
  const { data: profile } = useQuery({
    queryKey: ['employee-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      

      return data as Profile;
    },
    enabled: !!user,
  });

  // QUERY: Employees Record (Self-seeds designation & base salary if missing)
  const { data: employee } = useQuery({
    queryKey: ['employee-record', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      
      if (!data) {
        const { data: inserted } = await supabase
          .from('employees')
          .insert({
            user_id: user!.id,
            full_name: profile?.full_name || user!.email?.split('@')[0] || 'Employee Admin',
            designation: 'Senior Cloud Engineer',
            department: 'Engineering',
            base_salary: 95000,
            status: 'active',
            joining_date: new Date(Date.now() - 3600000 * 24 * 240).toISOString().split('T')[0],
            phone: '+880 1712-345678'
          })
          .select()
          .maybeSingle();
        return inserted as Employee | null;
      }
      return data as Employee | null;
    },
    enabled: !!user && !!profile,
  });

  // QUERY: Payroll History (Self-seeds payslips if missing)
  const { data: payrollHistory = [] } = useQuery({
    queryKey: ['employee-payroll', employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_log')
        .select('*')
        .eq('employee_id', employee!.id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return (data || []) as PayrollLog[];
    },
    enabled: !!employee?.id,
  });

  // QUERY: Leave Applications (Self-seeds if missing)
  const { data: leaveApplications = [] } = useQuery({
    queryKey: ['leave-applications', employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('employee_id', employee!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id,
  });

  // QUERY: IT Helpdesk Tickets (Self-seeds if empty)
  const { data: tickets = [] } = useQuery({
    queryKey: ['it-tickets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_tickets')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // QUERY: Announcements (Self-seeds if empty)
  const { data: announcements = [] } = useQuery({
    queryKey: ['portal-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_announcements')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  // UNREAD TEAM MESSAGES COUNT (for employee header badge)
  const { data: unreadMessagesCount = 0 } = useQuery({
    queryKey: ['unread_sidebar_count', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('team_messages')
        .select('id', { count: 'exact', head: true })
        .not('seen_by', 'cs', `{${user?.id}}`)
        .neq('sender_id', user?.id)
        .or(`receiver_id.is.null,receiver_id.eq.${user?.id}`);

      if (error) return 0;
      return count || 0;
    },
    refetchOnWindowFocus: true,
  });

  // QUERY: Company Events (Self-seeds if empty)
  const { data: events = [] } = useQuery({
    queryKey: ['portal-events'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('company_events').select('*').order('event_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  // QUERY: Documents (Self-seeds payslips & handbooks if empty)
  const { data: documents = [] } = useQuery({
    queryKey: ['portal-documents', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  // QUERY: Assigned Hardware Assets (Self-seeds if empty)
  const { data: assignedAssets = [] } = useQuery({
    queryKey: ['portal-assets', employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('assigned_to', employee!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id
  });

  // QUERY: My OKRs (Self-seeds quarterly objectives if empty)
  const { data: myOkrs = [] } = useQuery({
    queryKey: ['portal-okrs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('okr_objectives')
        .select('*, key_results:okr_key_results(*)')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  // QUERY: Assigned Projects (Self-bridges project assignments if empty)
  const { data: myProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['portal-assigned-projects', employee?.id],
    queryFn: async () => {
      try {
        const { data: assignments, error: assignmentsError } = await (supabase
          .from('project_assignments' as any)
          .select('project_id')
          .eq('employee_id', employee!.id) as any);
        
        if (assignmentsError) throw assignmentsError;
        
        const assignmentsList = assignments || [];
        if (assignmentsList.length === 0) return [];
        const projectIds = assignmentsList.map((a: any) => a.project_id);
        
        const { data: projects, error: projectsError } = await supabase
          .from('active_projects')
          .select('*')
          .in('id', projectIds);
          
        if (projectsError) throw projectsError;
        return projects || [];
      } catch (e) {
        console.error('Error fetching assigned projects:', e);
        return [];
      }
    },
    enabled: !!employee?.id,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('it_tickets').insert({
        user_id: user!.id,
        ...payload
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['it-tickets'] });
      sendNotification({
        title: 'New IT Support Ticket',
        message: `${profile?.full_name || 'An employee'} submitted a new IT ticket: ${ticketData.title}`,
        type: 'warning',
        actionLink: `/helpdesk`
      });
      toast.success('Support ticket submitted!');
      setTicketDialogOpen(false);
      setTicketData({ title: '', description: '', category: 'software', priority: 'medium' });
    },
    onError: (error) => toast.error(error.message)
  });

  const cancelLeaveMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      const { error } = await supabase
        .from('leave_applications')
        .update({ status: 'cancelled' })
        .eq('id', leaveId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] });
      toast.success('Leave application cancelled');
    },
    onError: (error) => {
      toast.error('Failed to cancel leave: ' + error.message);
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);

    try {
      const res = await fetch(CLOUDINARY_URL, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        setEditData(prev => ({ ...prev, avatar_url: data.secure_url }));
        toast.success("Avatar uploaded successfully!");
      }
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { full_name: string; phone: string; avatar_url: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone,
          avatar_url: data.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-profile'] });
      sendNotification({
        title: 'Profile Updated',
        message: `${profile?.full_name || 'An employee'} has updated their profile information.`,
        type: 'info',
        actionLink: `/team`
      });
      toast.success('Profile updated successfully');
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error('Failed to update profile: ' + error.message);
    },
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleEdit = () => {
    setEditData({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      avatar_url: profile?.avatar_url || '',
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateProfileMutation.mutate(editData);
  };

  const totalEarnings = useMemo(() => {
    return payrollHistory.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  }, [payrollHistory]);

  const initials = useMemo(() => {
    return (profile?.full_name || user?.email || 'U')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [profile, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:overflow-hidden lg:h-screen">
      {/* GLOWING APP HEADER */}
      <header className="border-b bg-white/60 dark:bg-slate-900/60 border-border/50 backdrop-blur-xl shrink-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <img src={logo} className="h-9 w-9" alt="TechWisdom Logo" />
            </div>
            <div>
              <span className="font-black text-slate-800 dark:text-white text-base tracking-tight">TechWisdom ERP</span>
              <p className="text-2xs text-slate-450 uppercase font-black tracking-widest leading-none mt-0.5">Self-Service Terminal</p>
            </div>
          </div>
          <div className="flex items-center gap-4.5">
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/teamChat')} className="font-bold text-xs h-9 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950/20">
                <MessageSquare className="h-4 w-4 mr-1.5" />
                  <span className="flex items-center gap-2">
                    <span>Team Chat</span>
                    {unreadMessagesCount > 0 && (
                      <span className="inline-flex items-center justify-center bg-rose-500 text-white text-[10px] font-black h-5 min-w-[20px] px-2 rounded-full shadow-sm">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/meeting')} className="font-bold text-xs h-9 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950/20">
                <Video className="h-4 w-4 mr-1.5" />
                Conference
              </Button>
            </div>
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={handleSignOut} className="font-bold text-xs border-border/60 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl h-9">
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* INDEPENDENTLY SCROLLING WORKSPACE GRID (FITS VIEWPORT EXACTLY) */}
      <main className="container mx-auto px-6 py-6 flex-1 min-h-0 lg:overflow-hidden flex flex-col lg:flex-row gap-6">
        
        {/* LEFT COLUMN: PROFILE CARD & EMPLOYMENT SPECS (SCROLLS INDEPENDENTLY) */}
        <div className="w-full lg:w-[320px] shrink-0 lg:overflow-y-auto lg:max-h-full scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] space-y-6 pb-6">
          
          {/* PROFILE SUMMARY GLOW CARD */}
          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-r from-primary/10 via-indigo-500/10 to-purple-500/10" />
            <CardContent className="pt-10 flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 text-xl border-4 border-white dark:border-slate-900 shadow-md">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-white font-extrabold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-lg font-black text-slate-800 dark:text-white mt-3 leading-snug">{profile?.full_name || 'Employee'}</h2>
              <p className="text-xs font-bold text-slate-450 uppercase tracking-wide mt-0.5">{employee?.designation || 'Team Member'}</p>
              
              {employee?.department && (
                <Badge variant="outline" className="mt-2.5 rounded-lg border-primary/20 bg-primary/5 text-primary text-[10px] uppercase font-black tracking-wide">
                  {employee.department}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* PERSONAL BIO CONTACTS */}
          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" />
                  Personal Information
                </CardTitle>
                
                {!isEditing ? (
                  <Button variant="ghost" size="sm" onClick={handleEdit} className="h-7 px-2.5 rounded-lg text-2xs font-extrabold hover:bg-slate-50 dark:hover:bg-slate-950/20 text-slate-500">
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-7 w-7 rounded-lg p-0">
                      <X className="h-4.5 w-4.5 text-slate-500" />
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={updateProfileMutation.isPending} className="h-7 px-2.5 rounded-lg text-2xs font-bold bg-primary text-white">
                      <Save className="h-3 w-3 mr-1" /> Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5">
              {isEditing ? (
                <div className="space-y-3.5">
                  <div className="flex flex-col items-center gap-2.5 mb-2">
                    <div className="relative group shrink-0">
                      <Avatar className="h-16 w-16 border-2 border-primary/20">
                        <AvatarImage src={editData.avatar_url} />
                        <AvatarFallback className="bg-primary text-white text-base font-extrabold">{initials}</AvatarFallback>
                      </Avatar>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/45 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                        {isUploading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Camera className="h-4.5 w-4.5" />}
                        <input type="file" className="hidden" onChange={handleAvatarUpload} accept="image/*" disabled={isUploading} />
                      </label>
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Click photo to upload</span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-2xs font-black uppercase tracking-wider text-slate-450 block pl-0.5">Full Name</Label>
                    <Input value={editData.full_name} onChange={e => setEditData({ ...editData, full_name: e.target.value })} className="rounded-xl h-9 text-xs border-border/60 font-semibold px-3" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-2xs font-black uppercase tracking-wider text-slate-450 block pl-0.5">Phone Number</Label>
                    <Input value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} className="rounded-xl h-9 text-xs border-border/60 font-semibold px-3" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs font-semibold text-slate-600 dark:text-slate-350">
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="truncate block" title={profile?.email || user?.email}>{profile?.email || user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{profile?.phone || employee?.phone || 'No phone set'}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>Joined: {employee?.joining_date ? format(new Date(employee.joining_date), 'MMM dd, yyyy') : 'N/A'}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* EMPLOYMENT DETAILS CARD */}
          <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-primary" />
                Employment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs font-semibold text-slate-655 dark:text-slate-350">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Designation</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{employee?.designation || 'N/A'}</span>
              </div>
              <Separator className="opacity-60" />
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Department</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{employee?.department || 'N/A'}</span>
              </div>
              <Separator className="opacity-60" />
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Base Salary</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  ৳{Number(employee?.base_salary || 0).toLocaleString()}/mo
                </span>
              </div>
              <Separator className="opacity-60" />
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Status</span>
                <Badge className={`rounded-lg uppercase text-[9px] font-black border-0 ${employee?.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-450'}`}>
                  {employee?.status || 'Active'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: WORKSPACE TAB PANELS (FITS SCREEN EXACTLY) */}
        <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden">
          
          <Tabs value={activeWorkspaceTab} onValueChange={setActiveWorkspaceTab} className="h-full flex flex-col min-h-0">
            {/* TABS TRIGGER ROW (SCROLLABLE & HIGHLIGHTED) */}
            <div className="w-full bg-white/60 dark:bg-slate-900/60 border border-border/60 backdrop-blur-xl p-3 rounded-2xl shadow-lg shrink-0 mb-4">
              <TabsList className="bg-transparent border-0 flex flex-wrap gap-2 h-auto p-0 justify-start select-none w-full">
                <TabsTrigger value="projects" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <FolderKanban className="h-4 w-4" /> Assigned Projects
                </TabsTrigger>
                <TabsTrigger value="announcements" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <Megaphone className="h-4 w-4" /> Announcements
                </TabsTrigger>
                <TabsTrigger value="events" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <Calendar className="h-4 w-4" /> Company Events
                </TabsTrigger>
                <TabsTrigger value="leave" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <CalendarDays className="h-4 w-4" /> Leave Ledger
                </TabsTrigger>
                <TabsTrigger value="salary" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <DollarSign className="h-4 w-4" /> Salary History
                </TabsTrigger>
                <TabsTrigger value="helpdesk" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <LifeBuoy className="h-4 w-4" /> IT Helpdesk
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <FileText className="h-4 w-4" /> Document Vault
                </TabsTrigger>
                <TabsTrigger value="assets" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <Package className="h-4 w-4" /> Assigned Assets
                </TabsTrigger>
                <TabsTrigger value="okrs" className="flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <Target className="h-4 w-4" /> Objectives (OKRs)
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB CONTENTS (SCROLLABLE INDEPENDENTLY WITH ZERO SCROLLBARS) */}
            <div className="flex-1 min-h-0 lg:overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] pb-6">
              
              {/* TAB: PROJECTS */}
              <TabsContent value="projects" className="m-0 focus-visible:outline-none">
                <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden flex flex-col">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <FolderKanban className="h-5 w-5 text-indigo-500" />
                      Assigned Workspace Pipeline
                    </CardTitle>
                    <CardDescription className="text-2xs font-semibold text-slate-450 uppercase tracking-wide">
                      Active client contracts and technical development pipelines explicitly assigned to your handle.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 px-6">
                    {loadingProjects ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p className="text-xs font-bold text-slate-450 uppercase">Loading assigned projects...</p>
                      </div>
                    ) : myProjects.length === 0 ? (
                      <div className="text-center py-14 border border-dashed rounded-2xl border-border/60 bg-slate-500/5">
                        <FolderKanban className="h-10 w-10 mx-auto text-slate-400 mb-3 opacity-40" />
                        <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-350">No Project Pipelines</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                          You are not currently assigned to any active client projects. Your assignments will reflect here once provisioned by an administrator.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-6 sm:grid-cols-2">
                        {myProjects.map((proj: any) => {
                          const stagesList = ['discovery', 'requirement', 'strategy', 'design', 'development', 'qa', 'deployment', 'maintenance'];
                          const stageIdx = stagesList.indexOf(proj.stage);
                          const progress = ((stageIdx + 1) / stagesList.length) * 100;
                          
                          return (
                            <div key={proj.id} className="border border-border/50 bg-white/40 dark:bg-slate-950/20 rounded-2xl p-5 hover:shadow-md transition-all flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start gap-2 mb-2.5">
                                  <Badge className="capitalize text-[10px] font-black rounded-lg border-primary/20 bg-primary/5 text-primary border shadow-none">
                                    {proj.project_type}
                                  </Badge>
                                  <Badge className={`uppercase text-[9px] tracking-wider font-black rounded-lg border-none py-0.5 px-2 ${proj.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-450'}`}>
                                    {proj.status}
                                  </Badge>
                                </div>
                                <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 line-clamp-1">{proj.project_name}</h3>
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                  Client: <span className="font-black text-slate-700 dark:text-slate-300">{proj.client_name}</span>
                                </p>
                                
                                <div className="space-y-1.5 mt-4">
                                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase tracking-wide">
                                    <span>Stage: {proj.stage}</span>
                                    <span>{Math.round(progress)}% Done</span>
                                  </div>
                                  <Progress value={progress} className="h-1.5 bg-slate-100 dark:bg-slate-850" />
                                </div>
                              </div>

                              <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between text-2xs font-bold text-slate-400">
                                <div>
                                  <span className="block uppercase tracking-wider text-[9px]">Deadline</span>
                                  <span className={proj.deadline ? "text-rose-500 font-black" : "font-semibold"}>
                                    {proj.deadline ? format(new Date(proj.deadline), 'MMM d, yyyy') : 'No Deadline'}
                                  </span>
                                </div>
                                <Button onClick={() => navigate(`/projects/${proj.id}`)} className="h-8 rounded-lg text-2xs font-extrabold gradient-primary text-white flex items-center gap-1">
                                  Workspace <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: ANNOUNCEMENTS */}
              <TabsContent value="announcements" className="m-0 focus-visible:outline-none">
                <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <Megaphone className="h-5 w-5 text-amber-500 animate-pulse" />
                      Company Bulletin Board
                    </CardTitle>
                    <CardDescription className="text-2xs font-semibold text-slate-450 uppercase tracking-wide">
                      Urgent broadcasts, operational notifications, and general announcements from administration.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4 px-6">
                    {announcements.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">No broadcasts found.</div>
                    ) : (
                      announcements.map((a: any) => (
                        <div key={a.id} className="p-4 border border-border/50 rounded-2xl bg-white/40 dark:bg-slate-950/20 relative overflow-hidden transition-all hover:translate-x-0.5">
                          <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary" />
                          <div className="flex justify-between items-center pl-1.5 mb-2">
                            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">{a.title}</h3>
                            <Badge className={`rounded-lg uppercase text-[9px] font-black tracking-wider py-0.5 border-none shadow-none ${a.type === 'urgent' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-100 text-slate-450'}`}>{a.type}</Badge>
                          </div>
                          <p className="pl-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-350 font-semibold">{a.content}</p>
                          <div className="pl-1.5 mt-3 pt-3 border-t border-border/30 text-[9px] font-black uppercase text-slate-400">
                            Broadcast date: {format(new Date(a.created_at), 'PPP')}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: EVENTS */}
              <TabsContent value="events" className="m-0 focus-visible:outline-none">
                <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <Calendar className="h-5 w-5 text-primary" />
                      Company Events & Calendar
                    </CardTitle>
                    <CardDescription className="text-2xs font-semibold text-slate-450 uppercase tracking-wide">
                      Co-working sessions, holiday schedules, releases, and corporate retreats.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4 px-6">
                    {events.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">No events scheduled.</div>
                    ) : (
                      events.map((event: any) => (
                        <div key={event.id} className="flex gap-4 p-4 border border-border/50 rounded-2xl bg-white/40 dark:bg-slate-950/20 transition-all hover:scale-[0.99]">
                          <div className="flex flex-col items-center justify-center bg-primary/10 rounded-xl p-2.5 min-w-[64px] shrink-0 text-center">
                            <span className="text-[10px] font-black text-primary uppercase tracking-wider">{format(new Date(event.event_date), 'MMM')}</span>
                            <span className="text-lg font-black text-primary leading-none mt-0.5">{format(new Date(event.event_date), 'd')}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-extrabold text-sm text-slate-805 dark:text-white leading-tight">{event.title}</h4>
                            {event.description && <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">{event.description}</p>}
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2.5">
                              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 opacity-70" /> {format(new Date(event.event_date), 'h:mm a')}</span>
                              {event.location && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 opacity-70" /> {event.location}</span>}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: LEAVE */}
              <TabsContent value="leave" className="m-0 focus-visible:outline-none">
                <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        Leave Application Ledger
                      </CardTitle>
                      <CardDescription className="text-2xs font-semibold text-slate-450 uppercase tracking-wide">
                        Apply for leaves and track approval responses.
                      </CardDescription>
                    </div>
                    <Button onClick={() => setLeaveDialogOpen(true)} disabled={!employee} className="h-9 px-4 rounded-xl text-xs font-bold gradient-primary text-white shrink-0">
                      <Plus className="h-4 w-4 mr-1" /> Apply Leave
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3.5 px-6">
                    {leaveApplications.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">No applications registered.</div>
                    ) : (
                      leaveApplications.map((leave) => {
                        const days = differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
                        const statusConfig = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
                        const StatusIcon = statusConfig.icon;
                        
                        return (
                          <div key={leave.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-border/50 rounded-2xl bg-white/40 dark:bg-slate-950/20 gap-4">
                            <div className="flex-1 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 leading-tight">
                                  {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
                                </h4>
                                <Badge variant="secondary" className="rounded-lg text-[9px] font-black tracking-wider uppercase">{days} Day{days > 1 ? 's' : ''}</Badge>
                              </div>
                              <p className="text-xs text-slate-500 font-semibold">
                                {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d, yyyy')}
                              </p>
                              {leave.reason && <p className="text-2xs font-bold text-slate-400 italic mt-1 pl-1.5 border-l-2 border-primary/20">" {leave.reason} "</p>}
                              {leave.review_notes && <p className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">Review note: {leave.review_notes}</p>}
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-border/30">
                              <div className={`flex items-center gap-1 text-2xs font-black uppercase tracking-wider py-0.5 px-2.5 rounded-lg border-none shadow-none ${statusConfig.color}`}>
                                <StatusIcon className="h-3 w-3" />
                                <span>{statusConfig.label}</span>
                              </div>
                              {leave.status === 'pending' && (
                                <Button size="sm" variant="ghost" onClick={() => cancelLeaveMutation.mutate(leave.id)} disabled={cancelLeaveMutation.isPending} className="h-8 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-500/10">
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: SALARY */}
              <TabsContent value="salary" className="m-0 focus-visible:outline-none">
                <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <DollarSign className="h-5 w-5 text-emerald-500" />
                        Salary History Vault
                      </CardTitle>
                      <CardDescription className="text-2xs font-semibold text-slate-450 uppercase tracking-wide">
                        Verified company payroll disbursements and monthly compensation audits.
                      </CardDescription>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Gross Earnings</span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">৳{totalEarnings.toLocaleString()}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3.5 px-6">
                    {payrollHistory.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">No salary dispatches recorded.</div>
                    ) : (
                      payrollHistory.map((record) => (
                        <div key={record.id} className="flex justify-between items-center p-4 border border-border/50 rounded-2xl bg-white/40 dark:bg-slate-950/20">
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 leading-tight">
                              {format(new Date(record.payment_date), 'MMMM yyyy')}
                            </h4>
                            <div className="flex gap-3.5 text-[10px] font-bold mt-1">
                              {record.bonus && Number(record.bonus) > 0 && <span className="text-emerald-600 dark:text-emerald-450">+৳{Number(record.bonus).toLocaleString()} bonus</span>}
                              {record.deduction && Number(record.deduction) > 0 && <span className="text-rose-500">-৳{Number(record.deduction).toLocaleString()} deduction</span>}
                              {!record.bonus && !record.deduction && <span className="text-slate-400">Standard monthly base payslip</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">৳{Number(record.amount_paid).toLocaleString()}</span>
                            <Badge variant="outline" className="h-4.5 rounded text-[8px] uppercase font-black bg-emerald-500/5 text-emerald-600 border-none ml-2 select-none">Paid</Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: HELPDESK */}
              <TabsContent value="helpdesk" className="m-0 focus-visible:outline-none">
                <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <Monitor className="h-5 w-5 text-primary" />
                        IT Support Helpdesk
                      </CardTitle>
                      <CardDescription className="text-2xs font-semibold text-slate-450 uppercase tracking-wide">
                        Report technical glitches, request credentials, or submit asset allocation calls.
                      </CardDescription>
                    </div>
                    <Button onClick={() => setTicketDialogOpen(true)} className="h-9 px-4 rounded-xl text-xs font-bold gradient-primary text-white shrink-0">
                      <Plus className="h-4 w-4 mr-1" /> New Ticket
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3.5 px-6">
                    {tickets.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">No support tickets active.</div>
                    ) : (
                      tickets.map((ticket: any) => {
                        const pStyles: Record<string, string> = {
                          urgent: "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black border-none",
                          high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border-none",
                          medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border-none",
                          low: "bg-slate-500/10 text-slate-600 dark:text-slate-400 font-bold border-none"
                        };
                        const sStyles: Record<string, string> = {
                          open: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border-none",
                          in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border-none",
                          resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-none",
                          closed: "bg-slate-500/10 text-slate-450 dark:text-slate-400 font-bold border-none"
                        };
                        return (
                          <div key={ticket.id} className="flex flex-col md:flex-row md:items-center justify-between p-4.5 border border-border/50 rounded-2xl bg-white/40 dark:bg-slate-950/20 gap-4">
                            <div className="flex-1 space-y-1 min-w-0">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-205 leading-snug truncate pr-1">
                                  {ticket.title}
                                </h4>
                                <Badge variant="outline" className={`rounded-lg text-[9px] uppercase tracking-wider h-5 font-black px-2 ${pStyles[ticket.priority] || pStyles.medium}`}>
                                  {ticket.priority === 'urgent' && <AlertTriangle className="h-2.5 w-2.5 mr-0.5 animate-bounce" />}
                                  {ticket.priority || 'medium'}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-medium whitespace-pre-wrap">{ticket.description}</p>
                              
                              <div className="flex items-center gap-3.5 text-[9px] font-black uppercase text-slate-400 pt-1">
                                <span>Category: <span className="text-primary">{ticket.category}</span></span>
                                <span>•</span>
                                <span>Date: {format(new Date(ticket.created_at), 'MMM d, yyyy')}</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-start md:items-end gap-2.5 shrink-0 border-t md:border-t-0 pt-3.5 md:pt-0 border-border/30">
                              <Badge className={`rounded-lg text-[9px] uppercase tracking-wider py-0.5 px-2.5 ${sStyles[ticket.status] || sStyles.open}`}>
                                {ticket.status.replace('_', ' ')}
                              </Badge>
                              {ticket.resolution_notes && (
                                <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl text-2xs font-semibold leading-relaxed max-w-[260px]">
                                  <strong className="block text-[8px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-350 mb-0.5">Resolution Notes</strong>
                                  "{ticket.resolution_notes}"
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: DOCUMENTS */}
              <TabsContent value="documents" className="m-0 focus-visible:outline-none">
                <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <FileText className="h-5 w-5 text-indigo-500" />
                      Personal Document Vault
                    </CardTitle>
                    <CardDescription className="text-2xs font-semibold text-slate-450 uppercase tracking-wide">
                      Secure, cryptographically restricted access to agreements, policies, and contracts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 px-6">
                    {documents.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">Vault is empty.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {documents.map((d: any) => (
                          <div key={d.id} className="flex items-center justify-between gap-4 p-4 border border-border/50 rounded-2xl bg-white/40 dark:bg-slate-950/20 hover:scale-[0.99] transition-all min-w-0">
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              <div className="h-10 w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <h4 className="font-extrabold text-xs text-slate-850 dark:text-slate-200 truncate leading-tight">{d.title}</h4>
                                <div className="flex items-center gap-2 mt-1.5 text-[9px] font-black uppercase text-slate-400">
                                  <Badge variant="secondary" className="rounded-lg text-[8px] font-black py-0.5 tracking-wide">{d.type}</Badge>
                                  <span>{format(new Date(d.created_at), 'MMM dd, yyyy')}</span>
                                </div>
                              </div>
                            </div>
                            {d.document_url && (
                              <Button variant="outline" size="sm" asChild className="h-8 rounded-lg text-2xs font-bold border-border/60 hover:bg-slate-50 dark:hover:bg-slate-950/20 shrink-0 shadow-sm">
                                <a href={d.document_url} target="_blank" rel="noreferrer">Open File</a>
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: ASSETS */}
              <TabsContent value="assets" className="m-0 focus-visible:outline-none">
                <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <Package className="h-5 w-5 text-indigo-500" />
                      Assigned Company Hardware
                    </CardTitle>
                    <CardDescription className="text-2xs font-semibold text-slate-450 uppercase tracking-wide">
                      Track physical corporate equipment, servers, and computing keys provisioned to your profile.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 px-6">
                    {assignedAssets.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">No hardware assigned.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assignedAssets.map((asset: any) => (
                          <div key={asset.id} className="p-4.5 border border-border/50 rounded-2xl bg-white/40 dark:bg-slate-950/20 flex flex-col justify-between hover:scale-[0.99] transition-all">
                            <div>
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <h4 className="font-extrabold text-sm text-slate-805 dark:text-white leading-tight">{asset.asset_name}</h4>
                                <Badge className="rounded-lg text-[9px] uppercase tracking-wider font-black bg-primary/5 text-primary border border-primary/20 shadow-none py-0.5">{asset.category}</Badge>
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asset tag: <span className="font-mono text-slate-600 dark:text-slate-350">{asset.asset_tag}</span></p>
                              {asset.brand && <p className="text-2xs font-semibold text-slate-500 mt-1 leading-relaxed">{asset.brand} | Model: {asset.model} (S/N: {asset.serial_number})</p>}
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-border/30 flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                              <span>Deploy Status</span>
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-none rounded-lg text-[9px] uppercase font-black tracking-wider py-0.5 px-2">Deployed</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: OKRS */}
              <TabsContent value="okrs" className="m-0 focus-visible:outline-none">
                <Card className="glass-card bg-white/60 dark:bg-slate-900/60 border border-border/60 shadow-xl rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <Target className="h-5 w-5 text-indigo-500" />
                      Quarterly Objectives (OKRs)
                    </CardTitle>
                    <CardDescription className="text-2xs font-semibold text-slate-450 uppercase tracking-wide">
                      Track and grade active strategic objectives and key results targets.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6 px-6">
                    {myOkrs.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">No OKRs registered.</div>
                    ) : (
                      myOkrs.map((okr: any) => (
                        <div key={okr.id} className="p-5 border border-border/50 rounded-2xl bg-white/40 dark:bg-slate-950/20 space-y-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <h3 className="font-extrabold text-base text-slate-850 dark:text-white leading-tight">{okr.title}</h3>
                              <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">{okr.description}</p>
                            </div>
                            <Badge className="rounded-lg uppercase text-[9px] font-black bg-primary/10 text-primary border-none select-none py-0.5 px-2.5 shrink-0">{okr.status}</Badge>
                          </div>

                          <div className="space-y-3.5 pl-3 border-l-2 border-primary/20 pt-1">
                            {okr.key_results?.map((kr: any) => {
                              const progressPercent = Math.min(100, Math.round((kr.current_value / kr.target_value) * 100));
                              return (
                                <div key={kr.id} className="space-y-1">
                                  <div className="flex justify-between text-2xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-350">
                                    <span className="truncate pr-2">{kr.title}</span>
                                    <span className="shrink-0 text-slate-800 dark:text-slate-100">{kr.current_value} / {kr.target_value}</span>
                                  </div>
                                  <Progress value={progressPercent} className="h-1.5 bg-slate-100 dark:bg-slate-850" />
                                </div>
                              );
                            })}
                            {(!okr.key_results || okr.key_results.length === 0) && (
                              <p className="text-xs text-slate-400 font-semibold italic">No key results mapped.</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            </div>
          </Tabs>

        </div>

      </main>

      {/* IT HELPDESK MODAL DRAWER */}
      <Dialog open={ticketDialogOpen} onOpenChange={o => !o && setTicketDialogOpen(false)}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl border border-border/40 shadow-2xl bg-card">
          <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-850 dark:text-slate-100">
              <Ticket className="h-5 w-5 text-primary" /> Submit IT Support Ticket
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-655 dark:text-slate-400 uppercase tracking-wider block pl-0.5">Issue / Request Title</Label>
              <Input 
                placeholder="e.g. Need access to Figma, keyboard malfunctioning..." 
                value={ticketData.title} 
                onChange={e => setTicketData({ ...ticketData, title: e.target.value })} 
                className="rounded-xl h-10 shadow-xs border-border/60 focus-visible:ring-primary px-3.5 text-sm font-semibold"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-655 dark:text-slate-400 uppercase tracking-wider block pl-0.5">Category</Label>
                <Select value={ticketData.category} onValueChange={v => setTicketData({ ...ticketData, category: v })}>
                  <SelectTrigger className="rounded-xl h-10 shadow-xs border-border/60 hover:bg-muted/50 transition-all font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="software" className="text-sm font-medium">Software / App Access</SelectItem>
                    <SelectItem value="hardware" className="text-sm font-medium">Hardware / Laptop</SelectItem>
                    <SelectItem value="network" className="text-sm font-medium">Network / WiFi</SelectItem>
                    <SelectItem value="other" className="text-sm font-medium">Other Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-655 dark:text-slate-400 uppercase tracking-wider block pl-0.5">Priority</Label>
                <Select value={ticketData.priority} onValueChange={v => setTicketData({ ...ticketData, priority: v })}>
                  <SelectTrigger className="rounded-xl h-10 shadow-xs border-border/60 hover:bg-muted/50 transition-all font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="low" className="text-sm font-medium">Low - Not blocking</SelectItem>
                    <SelectItem value="medium" className="text-sm font-medium">Medium - Partially blocking</SelectItem>
                    <SelectItem value="high" className="text-sm font-medium">High - Severely blocking</SelectItem>
                    <SelectItem value="urgent" className="text-sm font-medium text-rose-600 font-bold">Urgent - Completely blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-655 dark:text-slate-400 uppercase tracking-wider block pl-0.5">Detailed Description</Label>
              <Textarea
                placeholder="Please describe your issue in detail. Include errors, system requirements, or brand tags if applicable..."
                className="min-h-[120px] rounded-2xl shadow-xs border-border/60 focus-visible:ring-primary p-3.5 text-sm leading-relaxed"
                value={ticketData.description}
                onChange={e => setTicketData({ ...ticketData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t border-border/50 bg-muted/10 flex flex-row items-center justify-end gap-2">
            <Button variant="outline" className="rounded-xl h-10 px-5 text-sm font-bold shadow-xs" onClick={() => setTicketDialogOpen(false)}>Cancel</Button>
            <Button 
              className="gradient-primary rounded-xl h-10 px-5 text-sm font-bold shadow-sm text-white hover:brightness-105 transition-all" 
              onClick={() => createTicketMutation.mutate(ticketData)} 
              disabled={createTicketMutation.isPending || !ticketData.title || !ticketData.description}
            >
              {createTicketMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Submit Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LEAVE DIALOG WINDOW */}
      {employee && (
        <LeaveApplicationDialog
          open={leaveDialogOpen}
          onOpenChange={setLeaveDialogOpen}
          employeeId={employee.id}
        />
      )}
    </div>
  );
}