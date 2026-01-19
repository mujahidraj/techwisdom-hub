import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  MessageSquare,
  Send,
  Users,
  Loader2,
  CheckCheck,
  Circle,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Message = Tables<'client_messages'>;

interface ProjectWithMessages {
  id: string;
  project_name: string;
  client_name: string;
  client_id: string | null;
  unreadCount: number;
}

export default function Messaging() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = role === 'admin';

  // Fetch projects for admin, or client's own projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['messaging-projects', user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from('active_projects')
        .select('id, project_name, client_name, client_id');

      if (!isAdmin) {
        query = query.eq('client_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get unread message counts
      const projectIds = data?.map(p => p.id) || [];
      const { data: messages } = await supabase
        .from('client_messages')
        .select('project_id, is_read, sender_id')
        .in('project_id', projectIds);

      return (data || []).map(p => ({
        ...p,
        unreadCount: (messages || []).filter(
          m => m.project_id === p.id && !m.is_read && m.sender_id !== user?.id
        ).length,
      })) as ProjectWithMessages[];
    },
    enabled: !!user?.id,
  });

  // Fetch messages for selected project
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedProject],
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-projects'] });
    },
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
      queryClient.invalidateQueries({ queryKey: ['messages', selectedProject] });
      queryClient.invalidateQueries({ queryKey: ['messaging-projects'] });
      setNewMessage('');
    },
    onError: (error) => {
      toast.error('Failed to send message: ' + error.message);
    },
  });

  // Mark as read when selecting project
  useEffect(() => {
    if (selectedProject) {
      markReadMutation.mutate(selectedProject);
    }
  }, [selectedProject]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set up real-time subscription
  useEffect(() => {
    if (!selectedProject) return;

    const channel = supabase
      .channel(`messages-${selectedProject}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_messages',
          filter: `project_id=eq.${selectedProject}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', selectedProject] });
          markReadMutation.mutate(selectedProject);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProject, queryClient]);

  const handleSend = () => {
    if (!newMessage.trim() || !selectedProject) return;
    sendMutation.mutate({ projectId: selectedProject, message: newMessage.trim() });
  };

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Communicate with clients about their projects.' : 'Chat with the team about your project.'}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-250px)] min-h-[500px]">
          {/* Projects List */}
          <Card className="glass-card lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                {isAdmin ? 'Client Projects' : 'Your Projects'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-380px)] min-h-[350px]">
                {projectsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground px-4">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>No projects found</p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => setSelectedProject(project.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                          selectedProject === project.id
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {project.client_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{project.project_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {project.client_name}
                          </p>
                        </div>
                        {project.unreadCount > 0 && (
                          <Badge className="bg-primary text-primary-foreground">
                            {project.unreadCount}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="glass-card lg:col-span-2 flex flex-col">
            {selectedProject ? (
              <>
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {selectedProjectData?.client_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{selectedProjectData?.project_name}</CardTitle>
                      <CardDescription>{selectedProjectData?.client_name}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 flex flex-col">
                  <ScrollArea className="flex-1 p-4">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg) => {
                          const isMine = msg.sender_id === user?.id;
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                  isMine
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <p className="text-sm">{msg.message}</p>
                                <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : ''}`}>
                                  <span className="text-xs opacity-70">
                                    {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                                  </span>
                                  {isMine && (
                                    msg.is_read ? (
                                      <CheckCheck className="h-3 w-3 opacity-70" />
                                    ) : (
                                      <Circle className="h-2 w-2 opacity-70" />
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>
                  <div className="p-4 border-t">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
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
                        className="gradient-primary"
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
                </CardContent>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Select a project to start messaging</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
