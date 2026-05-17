import { useEffect, useState } from 'react';
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
  Video
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { LeaveApplicationDialog } from '@/components/team/LeaveApplicationDialog';
import type { Tables } from '@/integrations/supabase/types';
import { Loader2, Camera } from 'lucide-react';

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
  pending: { label: 'Pending', icon: Clock, color: 'text-warning' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-success' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-destructive' },
  cancelled: { label: 'Cancelled', icon: X, color: 'text-muted-foreground' },
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

  useEffect(() => {
    if (!loading && (!user || role !== 'employee')) {
      navigate('/auth');
    }
  }, [user, role, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ['employee-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user,
  });

  const { data: employee } = useQuery({
    queryKey: ['employee-record', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Employee | null;
    },
    enabled: !!user,
  });

  const { data: payrollHistory = [] } = useQuery({
    queryKey: ['employee-payroll', employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_log')
        .select('*')
        .eq('employee_id', employee!.id)
        .order('payment_date', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as PayrollLog[];
    },
    enabled: !!employee?.id,
  });

  const { data: leaveApplications = [] } = useQuery({
    queryKey: ['leave-applications', employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('employee_id', employee!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['it-tickets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('it_tickets').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['portal-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_announcements').select('*').eq('is_published', true).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: events = [] } = useQuery({
    queryKey: ['portal-events'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('company_events').select('*').order('event_date', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['portal-documents', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('employee_documents').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: assignedAssets = [] } = useQuery({
    queryKey: ['portal-assets', employee?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('assets').select('*').eq('assigned_to', employee!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id
  });

  const { data: myOkrs = [] } = useQuery({
    queryKey: ['portal-okrs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('okr_objectives').select('*, key_results:okr_key_results(*)').eq('owner_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const totalEarnings = payrollHistory.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 gradient-primary rounded-lg">
              <img src={logo} className="h-10 w-10" alt="TechWisdom Logo" />
            </div>
            <div>
              <span className="font-bold text-lg">TechWisdom</span>
              <p className="text-xs text-muted-foreground">Employee Self-Service</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 mr-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/teamChat')}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Team Chat
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/meeting')}>
                <Video className="h-4 w-4 mr-2" />
                Conference
              </Button>
            </div>
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8 max-w-4xl">
        {/* Profile Header */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <Avatar className="h-24 w-24 text-2xl">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="gradient-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold">{profile?.full_name || 'Employee'}</h1>
                <p className="text-muted-foreground">{employee?.designation || 'Team Member'}</p>
                {employee?.department && (
                  <Badge variant="outline" className="mt-2">
                    {employee.department}
                  </Badge>
                )}
              </div>
              <Badge variant="default" className="text-sm">
                {employee?.status || 'Active'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal Information */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Personal Information
                </CardTitle>
                {!isEditing ? (
                  <Button variant="ghost" size="sm" onClick={handleEdit}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={updateProfileMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="flex flex-col items-center gap-4 mb-6">
                    <div className="relative group">
                      <Avatar className="h-24 w-24 border-4 border-primary/10">
                        <AvatarImage src={editData.avatar_url} />
                        <AvatarFallback className="gradient-primary text-primary-foreground text-xl">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                        {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                        <input type="file" className="hidden" onChange={handleAvatarUpload} accept="image/*" disabled={isUploading} />
                      </label>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Click to change avatar</p>
                  </div>
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      value={editData.full_name}
                      onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={editData.phone}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{profile?.email || user?.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{profile?.phone || employee?.phone || 'Not set'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Joined:{' '}
                      {employee?.joining_date
                        ? format(new Date(employee.joining_date), 'MMM d, yyyy')
                        : 'N/A'}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Employment Details */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Employment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Designation</span>
                <span className="font-medium">{employee?.designation || 'N/A'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{employee?.department || 'N/A'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Salary</span>
                <span className="font-medium">
                  ৳{Number(employee?.base_salary || 0).toLocaleString()}/month
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={employee?.status === 'active' ? 'default' : 'secondary'}>
                  {employee?.status || 'Active'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Leave & Salary */}
        <Tabs defaultValue="leave" className="space-y-4">
          <TabsList className="flex overflow-x-auto overflow-y-hidden w-full h-auto p-1 bg-muted/50 rounded-xl justify-start md:grid md:grid-cols-8">
            <TabsTrigger value="announcements" className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> <span className="hidden lg:inline">Bulletin</span></TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2"><Calendar className="h-4 w-4" /> <span className="hidden lg:inline">Events</span></TabsTrigger>
            <TabsTrigger value="leave" className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> <span className="hidden lg:inline">Leave</span></TabsTrigger>
            <TabsTrigger value="salary" className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> <span className="hidden lg:inline">Salary</span></TabsTrigger>
            <TabsTrigger value="helpdesk" className="flex items-center gap-2"><LifeBuoy className="h-4 w-4" /> <span className="hidden lg:inline">Helpdesk</span></TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2"><FileText className="h-4 w-4" /> <span className="hidden lg:inline">Documents</span></TabsTrigger>
            <TabsTrigger value="assets" className="flex items-center gap-2"><Package className="h-4 w-4" /> <span className="hidden lg:inline">Assets</span></TabsTrigger>
            <TabsTrigger value="okrs" className="flex items-center gap-2"><Target className="h-4 w-4" /> <span className="hidden lg:inline">My OKRs</span></TabsTrigger>
          </TabsList>

          {/* EVENTS */}
          <TabsContent value="events">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Company Events
                </CardTitle>
                <CardDescription>Company-wide meetings, holidays, and team events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {events.length === 0 ? (
                    <p className="text-muted-foreground">No upcoming events scheduled.</p>
                  ) : (
                    events.map((event: any) => (
                      <div key={event.id} className="flex gap-4 p-4 border rounded-xl bg-card hover:shadow-sm transition-shadow">
                        <div className="flex flex-col items-center justify-center bg-primary/10 rounded-lg p-2 min-w-[60px]">
                          <span className="text-xs font-bold text-primary uppercase">{format(new Date(event.event_date), 'MMM')}</span>
                          <span className="text-lg font-bold text-primary">{format(new Date(event.event_date), 'd')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground">{event.title}</h4>
                          {event.description && <p className="text-sm text-muted-foreground mt-1">{event.description}</p>}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
                            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {format(new Date(event.event_date), 'h:mm a')}</span>
                            {event.location && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {event.location}</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ANNOUNCEMENTS */}
          <TabsContent value="announcements">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Company Bulletin Board</CardTitle>
                <CardDescription>Latest news and updates from the team</CardDescription>
              </CardHeader>
              <CardContent>
                {announcements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No current announcements.</div>
                ) : (
                  <div className="space-y-4">
                    {announcements.map((a: any) => (
                      <div key={a.id} className="p-4 bg-muted/30 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-lg">{a.title}</h3>
                          <Badge variant={a.type === 'urgent' ? 'destructive' : 'outline'} className="capitalize">{a.type}</Badge>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-muted-foreground text-sm">{a.content}</p>
                        <p className="text-xs text-muted-foreground opacity-50 mt-4">{format(new Date(a.created_at), 'PPP')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      Leave Applications
                    </CardTitle>
                    <CardDescription>Your leave requests and history</CardDescription>
                  </div>
                  <Button onClick={() => setLeaveDialogOpen(true)} disabled={!employee}>
                    <Plus className="h-4 w-4 mr-2" />
                    Apply for Leave
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {leaveApplications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No leave applications yet. Apply for your first leave.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaveApplications.map((leave) => {
                      const days = differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
                      const statusConfig = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
                      const StatusIcon = statusConfig.icon;
                      return (
                        <div
                          key={leave.id}
                          className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
                              </p>
                              <Badge variant="secondary">{days} day{days > 1 ? 's' : ''}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d, yyyy')}
                            </p>
                            {leave.reason && (
                              <p className="text-xs text-muted-foreground mt-1">{leave.reason}</p>
                            )}
                            {leave.review_notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                Note: {leave.review_notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-1 ${statusConfig.color}`}>
                              <StatusIcon className="h-4 w-4" />
                              <span className="text-sm font-medium">{statusConfig.label}</span>
                            </div>
                            {leave.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => cancelLeaveMutation.mutate(leave.id)}
                                disabled={cancelLeaveMutation.isPending}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salary">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Salary History
                  </CardTitle>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total Earnings (Last 12 months)</p>
                    <p className="text-xl font-bold text-success">${totalEarnings.toLocaleString()}</p>
                  </div>
                </div>
                <CardDescription>Your recent salary payments</CardDescription>
              </CardHeader>
              <CardContent>
                {payrollHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No salary records found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payrollHistory.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {format(new Date(record.payment_date), 'MMMM yyyy')}
                          </p>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            {record.bonus && Number(record.bonus) > 0 && (
                              <span className="text-success">+${Number(record.bonus)} bonus</span>
                            )}
                            {record.deduction && Number(record.deduction) > 0 && (
                              <span className="text-destructive">-${Number(record.deduction)} deduction</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-success">
                            ${Number(record.amount_paid).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="helpdesk">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-primary" />
                      IT Helpdesk
                    </CardTitle>
                    <CardDescription>Request software, hardware, or report issues</CardDescription>
                  </div>
                  <Button onClick={() => setTicketDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Ticket
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No support tickets found. You're all good!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map((ticket: any) => (
                      <div key={ticket.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/50 rounded-lg gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{ticket.title}</p>
                            {ticket.priority === 'urgent' && <Badge variant="destructive" className="h-5 px-1.5"><AlertTriangle className="h-3 w-3 mr-1" /> Urgent</Badge>}
                            {ticket.priority === 'high' && <Badge variant="destructive" className="h-5 px-1.5">High</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{ticket.description}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                            <span className="capitalize">{ticket.category}</span>
                            <span>•</span>
                            <span>{format(new Date(ticket.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="outline" className="capitalize text-[10px]">{ticket.status.replace('_', ' ')}</Badge>
                          {ticket.resolution_notes && (
                            <p className="text-xs text-success max-w-[200px] truncate">Note: {ticket.resolution_notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DOCUMENTS */}
          <TabsContent value="documents">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Personal Document Vault</CardTitle>
                <CardDescription>Secure access to your payslips, contracts, and policies</CardDescription>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Your document vault is empty.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {documents.map((d: any) => (
                      <div key={d.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-semibold truncate">{d.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Badge variant="secondary" className="capitalize text-[10px]">{d.type}</Badge>
                            <span>{format(new Date(d.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                        {d.document_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={d.document_url} target="_blank" rel="noreferrer">View</a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ASSETS */}
          <TabsContent value="assets">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Assigned Assets</CardTitle>
                <CardDescription>Company equipment and licenses assigned to you</CardDescription>
              </CardHeader>
              <CardContent>
                {assignedAssets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">You have no assets currently assigned to you.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignedAssets.map((asset: any) => (
                      <div key={asset.id} className="p-4 border rounded-lg bg-muted/30 flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold">{asset.asset_name}</h4>
                          <Badge variant="outline" className="capitalize text-[10px]">{asset.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Tag: {asset.asset_tag}</p>
                        {asset.brand && <p className="text-sm text-muted-foreground">Brand: {asset.brand} {asset.model}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* OKRS */}
          <TabsContent value="okrs">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> My Objectives & Key Results</CardTitle>
                <CardDescription>Track your active quarterly goals</CardDescription>
              </CardHeader>
              <CardContent>
                {myOkrs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No active OKRs assigned to you.</div>
                ) : (
                  <div className="space-y-6">
                    {myOkrs.map((okr: any) => (
                      <div key={okr.id} className="p-5 border rounded-lg bg-card shadow-sm space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{okr.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{okr.description}</p>
                          </div>
                          <Badge className="capitalize">{okr.status}</Badge>
                        </div>

                        <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                          {okr.key_results?.map((kr: any) => {
                            const progressPercent = Math.min(Math.round(((kr.current_value - kr.start_value) / (kr.target_value - kr.start_value)) * 100), 100);
                            return (
                              <div key={kr.id} className="space-y-1.5">
                                <div className="flex justify-between text-sm">
                                  <span className="font-medium text-muted-foreground">{kr.title}</span>
                                  <span className="font-bold">{kr.current_value} / {kr.target_value}</span>
                                </div>
                                <Progress value={progressPercent} className="h-2" />
                              </div>
                            );
                          })}
                          {(!okr.key_results || okr.key_results.length === 0) && (
                            <p className="text-xs text-muted-foreground">No Key Results attached.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={ticketDialogOpen} onOpenChange={o => !o && setTicketDialogOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit IT Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Issue / Request Title</Label>
              <Input placeholder="e.g. Need access to Figma" value={ticketData.title} onChange={e => setTicketData({ ...ticketData, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={ticketData.category} onValueChange={v => setTicketData({ ...ticketData, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="software">Software / App Access</SelectItem>
                    <SelectItem value="hardware">Hardware / Laptop</SelectItem>
                    <SelectItem value="network">Network / WiFi</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={ticketData.priority} onValueChange={v => setTicketData({ ...ticketData, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Not blocking work</SelectItem>
                    <SelectItem value="medium">Medium - Partially blocking</SelectItem>
                    <SelectItem value="high">High - Severely blocking</SelectItem>
                    <SelectItem value="urgent">Urgent - Completely blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Please describe the issue in detail..."
                className="min-h-[100px]"
                value={ticketData.description}
                onChange={e => setTicketData({ ...ticketData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicketDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={() => createTicketMutation.mutate(ticketData)} disabled={createTicketMutation.isPending || !ticketData.title || !ticketData.description}>Submit Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Application Dialog */}
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