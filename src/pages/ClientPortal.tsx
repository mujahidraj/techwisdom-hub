import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import logo from '@/assets/techwisdom.png';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2,
  FolderKanban,
  Clock,
  CheckCircle2,
  LogOut,
  MessageSquare,
  Calendar,
  DollarSign,
  FileText,
  Send,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Tables, Database } from '@/integrations/supabase/types';

type Project = Tables<'active_projects'>;
type ProjectUpdate = Tables<'project_updates'>;
type Invoice = Tables<'invoices'>;
type Message = Tables<'client_messages'>;
type ProjectStage = Database['public']['Enums']['project_stage'];

const stages: ProjectStage[] = [
  'discovery',
  'requirement',
  'strategy',
  'design',
  'development',
  'qa',
  'deployment',
  'maintenance',
];

const stageLabels: Record<ProjectStage, string> = {
  discovery: 'Discovery',
  requirement: 'Requirement',
  strategy: 'Strategy',
  design: 'Design',
  development: 'Development',
  qa: 'QA',
  deployment: 'Deployment',
  maintenance: 'Maintenance',
};

export default function ClientPortal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role, signOut, loading } = useAuth();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && (!user || role !== 'client')) {
      navigate('/auth');
    }
  }, [user, role, loading, navigate]);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['client-projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_projects')
        .select('*')
        .eq('client_id', user?.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user,
  });

  const { data: updates = [] } = useQuery({
    queryKey: ['client-updates', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase
        .from('project_updates')
        .select('*')
        .in('project_id', projects.map(p => p.id))
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as ProjectUpdate[];
    },
    enabled: projects.length > 0,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['client-invoices', projects.map(p => p.id)],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .in('project_id', projects.map(p => p.id))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: projects.length > 0,
  });

  // Fetch messages for selected project
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['client-messages', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data, error } = await supabase
        .from('client_messages')
        .select('*')
        .eq('project_id', selectedProject)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedProject,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({ projectId, message }: { projectId: string; message: string }) => {
      const { error } = await supabase
        .from('client_messages')
        .insert({
          project_id: projectId,
          sender_id: user?.id,
          message,
          is_read: false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-messages', selectedProject] });
      setNewMessage('');
    },
    onError: (error) => {
      toast.error('Failed to send message: ' + error.message);
    },
  });

  // Mark messages as read
  const markReadMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('client_messages')
        .update({ is_read: true })
        .eq('project_id', projectId)
        .neq('sender_id', user?.id);
      if (error) throw error;
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when viewing project
  useEffect(() => {
    if (selectedProject) {
      markReadMutation.mutate(selectedProject);
    }
  }, [selectedProject]);

  // Real-time subscription for messages
  useEffect(() => {
    if (!selectedProject) return;

    const channel = supabase
      .channel(`client-messages-${selectedProject}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_messages',
          filter: `project_id=eq.${selectedProject}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['client-messages', selectedProject] });
          markReadMutation.mutate(selectedProject);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProject, queryClient]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedProject) return;
    sendMutation.mutate({ projectId: selectedProject, message: newMessage.trim() });
  };

  const getProgress = (stage: ProjectStage) => ((stages.indexOf(stage) + 1) / stages.length) * 100;

  if (loading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_budget), 0);
  const totalPaid = projects.reduce((sum, p) => sum + Number(p.paid_amount), 0);
  const pendingAmount = totalBudget - totalPaid;

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
              <p className="text-xs text-muted-foreground">Client Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Welcome to Your Portal</h1>
          <p className="text-muted-foreground mt-1">Track your projects, view updates, and manage invoices.</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.filter(p => p.status === 'active').length}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalBudget.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Amount Paid</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">${totalPaid.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">${pendingAmount.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Projects List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold">Your Projects</h2>
            {projects.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-12 text-center">
                  <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No projects assigned yet.</p>
                </CardContent>
              </Card>
            ) : (
              projects.map((project) => (
                <Card key={project.id} className="glass-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{project.project_name}</CardTitle>
                        <CardDescription>{project.project_type}</CardDescription>
                      </div>
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stage Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">{stageLabels[project.stage]}</span>
                        <span className="text-muted-foreground">
                          Stage {stages.indexOf(project.stage) + 1} of {stages.length}
                        </span>
                      </div>
                      <Progress value={getProgress(project.stage)} className="h-2" />
                    </div>

                    {/* Stage Steps */}
                    <div className="flex justify-between text-xs">
                      {stages.map((stage, idx) => (
                        <div
                          key={stage}
                          className={`flex flex-col items-center ${
                            idx <= stages.indexOf(project.stage)
                              ? 'text-primary'
                              : 'text-muted-foreground'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 rounded-full ${
                              idx <= stages.indexOf(project.stage)
                                ? 'bg-primary'
                                : 'bg-muted'
                            }`}
                          />
                          <span className="mt-1 hidden md:block">{stageLabels[stage]}</span>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Budget Info */}
                    <div className="flex justify-between text-sm">
                      <span>Budget: ${Number(project.total_budget).toLocaleString()}</span>
                      <span className="text-success">Paid: ${Number(project.paid_amount).toLocaleString()}</span>
                    </div>

                    {project.deadline && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Deadline: {format(new Date(project.deadline), 'MMM d, yyyy')}</span>
                      </div>
                    )}

                    {/* Message Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setSelectedProject(
                        selectedProject === project.id ? null : project.id
                      )}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {selectedProject === project.id ? 'Close Chat' : 'Message Team'}
                    </Button>

                    {/* Inline Chat */}
                    {selectedProject === project.id && (
                      <div className="border rounded-lg mt-3 bg-muted/30">
                        <ScrollArea className="h-64 p-3">
                          {messagesLoading ? (
                            <div className="flex items-center justify-center h-full">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                          ) : messages.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              No messages yet. Start the conversation!
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {messages.map((msg) => {
                                const isMine = msg.sender_id === user?.id;
                                return (
                                  <div
                                    key={msg.id}
                                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                  >
                                    <div
                                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                                        isMine
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-background border'
                                      }`}
                                    >
                                      <p className="text-sm">{msg.message}</p>
                                      <p className="text-xs opacity-70 mt-1">
                                        {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                              <div ref={messagesEndRef} />
                            </div>
                          )}
                        </ScrollArea>
                        <div className="p-3 border-t">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSendMessage();
                            }}
                            className="flex gap-2"
                          >
                            <Input
                              placeholder="Type a message..."
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              disabled={sendMutation.isPending}
                            />
                            <Button
                              type="submit"
                              size="icon"
                              disabled={!newMessage.trim() || sendMutation.isPending}
                            >
                              {sendMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </form>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Updates */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Recent Updates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {updates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No updates yet.</p>
                ) : (
                  updates.slice(0, 5).map((update) => (
                    <div key={update.id} className="border-l-2 border-primary pl-3 py-1">
                      <p className="font-medium text-sm">{update.title}</p>
                      <p className="text-xs text-muted-foreground">{update.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(update.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Invoices */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No invoices yet.</p>
                ) : (
                  invoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          ${Number(invoice.amount).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant={invoice.status === 'paid' ? 'default' : 'outline'}
                        className="capitalize"
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}