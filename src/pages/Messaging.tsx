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
import { useNotifications } from '@/hooks/useNotifications';
import {
  MessageSquare,
  Send,
  Users,
  Loader2,
  CheckCheck,
  Circle,
  ChevronLeft,
  Paperclip,
  Smile,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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
  const { sendNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<string | null>(searchParams.get('projectId'));
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
      // Mark messages as read in database
      await supabase
        .from('client_messages')
        .update({ is_read: true })
        .eq('project_id', projectId);

      // Global Notification Sync: Mark these specific notifications as read for ALL admins
      await supabase.from('app_notifications')
        .update({ is_read: true })
        .eq('title', 'New Client Message')
        .eq('action_link', `/messages?projectId=${projectId}`);
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

      // Notify the client
      if (selectedProjectData?.client_id) {
        sendNotification({
          userId: selectedProjectData.client_id,
          title: 'New Message from Team',
          message: `You have a new message regarding project: ${selectedProjectData.project_name}`,
          type: 'info',
          actionLink: '/client-portal'
        });
      }

      setNewMessage('');
    },
    onError: (error) => {
      toast.error('Failed to send message: ' + error.message);
    },
  });

  // Auto-select from URL if it changes
  useEffect(() => {
    const urlProjectId = searchParams.get('projectId');
    if (urlProjectId) {
      setSelectedProject(urlProjectId);
    }
  }, [searchParams]);

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
      <div className="flex flex-col h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] lg:h-[calc(100vh-112px)] lg:max-h-[calc(100vh-112px)] animate-fade-in text-slate-800 -mx-6 -my-6 lg:mx-0 lg:my-0">

        {/* Main Content Workspace */}
        <div className="flex-1 min-h-0 grid lg:grid-cols-3 gap-5 lg:gap-5 relative">

          {/* LEFT PANEL: Projects selection list */}
          <div className={`lg:col-span-1 flex flex-col min-h-0 bg-white/80 backdrop-blur-md border-0 lg:border border-slate-100 rounded-none lg:rounded-3xl lg:shadow-xl lg:shadow-slate-100/30 overflow-hidden transition-all duration-300 ${selectedProject ? 'hidden lg:flex' : 'flex'
            }`}>
            <div className="p-5 border-b border-slate-100/80">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-500" /> Active Clients
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {projects.length} Total
                </span>
              </div>
            </div>

            <ScrollArea className="flex-1 p-3">
              {projectsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing database...</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-5 w-5 text-slate-400" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-600">No Clients Available</h4>
                  <p className="text-xs text-slate-400 mt-1">There are no active projects assigned to your account.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {projects.map((project) => {
                    const isSelected = selectedProject === project.id;
                    return (
                      <button
                        key={project.id}
                        onClick={() => setSelectedProject(project.id)}
                        className={`w-full flex items-center gap-3.5 p-4 rounded-2xl text-left border transition-all duration-300 group hover:scale-[1.01] ${isSelected
                            ? 'bg-gradient-to-r from-orange-50/80 to-amber-50/40 border-orange-200/60 shadow-md shadow-orange-500/5'
                            : 'bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-100'
                          }`}
                      >
                        <Avatar className="h-11 w-11 shadow-sm shrink-0 border border-white">
                          <AvatarFallback className={`text-xs font-black uppercase transition-all ${isSelected
                              ? 'bg-gradient-to-tr from-orange-500 to-amber-500 text-white'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                            }`}>
                            {project.client_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate group-hover:text-orange-950 transition-colors ${isSelected ? 'text-orange-950 font-black' : 'text-slate-700'
                            }`}>
                            {project.project_name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-semibold mt-0.5 truncate uppercase tracking-wider">
                            {project.client_name}
                          </p>
                        </div>

                        {project.unreadCount > 0 && (
                          <span className="shrink-0 h-5 min-w-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black flex items-center justify-center px-1.5 shadow-md shadow-orange-500/20 animate-pulse">
                            {project.unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* RIGHT PANEL: Chat box section */}
          <div className={`lg:col-span-2 flex flex-col min-h-0 bg-white/85 backdrop-blur-md border-0 lg:border border-slate-100/90 rounded-none lg:rounded-3xl lg:shadow-xl lg:shadow-slate-100/30 overflow-hidden ${selectedProject ? 'flex' : 'hidden lg:flex'
            }`}>
            {selectedProject ? (
              <>
                {/* Active Chat Header */}
                <div className="p-4.5 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-sm shrink-0">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Back arrow on mobile */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedProject(null)}
                      className="lg:hidden h-9 w-9 rounded-xl border border-slate-100 bg-white text-slate-600 hover:bg-slate-50 shrink-0"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    
                    <div className="relative shrink-0">
                      <Avatar className="h-11 w-11 shadow-sm border border-white ring-2 ring-orange-500/10">
                        <AvatarFallback className="bg-gradient-to-tr from-orange-500 to-amber-500 text-white text-xs font-black">
                          {selectedProjectData?.client_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                    </div>
                    
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-800 truncate">{selectedProjectData?.project_name}</h4>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5 truncate">{selectedProjectData?.client_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-600 shadow-sm shadow-orange-500/5">
                      Secure Channel
                    </span>
                  </div>
                </div>

                {/* Active Message History - Standard overflow-y-auto for robust height fill */}
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50/20 space-y-5">
                  {messagesLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                      <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading channel logs...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-24 space-y-4">
                      <div className="h-14 w-14 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto shadow-sm animate-bounce">
                        <MessageSquare className="h-6 w-6 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm uppercase tracking-widest text-slate-600">Stream Initialized</h4>
                        <p className="text-xs text-slate-400 max-w-[240px] mx-auto mt-1 leading-relaxed">Start the sync channel by typing your project message below.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {messages.map((msg) => {
                        const isClient = msg.sender_id === selectedProjectData?.client_id;
                        const isMine = msg.sender_id === user?.id;
                        
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${!isClient ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[75%] md:max-w-[65%] flex flex-col ${!isClient ? 'items-end' : 'items-start'}`}>
                              <div className={`rounded-2xl px-5 py-3.5 shadow-md transition-all duration-300 hover:scale-[1.01] ${
                                !isClient
                                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-tr-none shadow-orange-500/10'
                                  : 'bg-white border border-slate-100 border-l-4 border-l-orange-500 text-slate-800 rounded-tl-none shadow-slate-100/50'
                              }`}>
                                {!isClient && !isMine && (
                                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400/80 mb-1">Team Sync</p>
                                )}
                                <p className="text-[13px] leading-relaxed font-medium whitespace-pre-wrap break-words">{msg.message}</p>
                              </div>
                              
                              <div className={`flex items-center gap-1.5 mt-1.5 px-1 text-[9px] font-black uppercase tracking-wider text-slate-400 ${!isClient ? 'justify-end' : ''}`}>
                                <span>{format(new Date(msg.created_at), 'MMM d, h:mm a')}</span>
                                {isMine && (
                                  msg.is_read ? (
                                    <span className="text-orange-500 flex items-center gap-0.5"><CheckCheck className="h-3.5 w-3.5" /> Read</span>
                                  ) : (
                                    <span className="text-slate-300 flex items-center gap-0.5"><Circle className="h-1.5 w-1.5 fill-slate-300" /> Sent</span>
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
                </div>

                {/* Input Composer Box attached flush with the bottom */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-3 bg-white border-t border-slate-100 p-4 items-center shrink-0"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 shrink-0"
                    onClick={() => toast.info("Attachment engine ready")}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  
                  <Input
                    placeholder="Send a secure message regarding project..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sendMutation.isPending}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm text-slate-800 placeholder-slate-400 flex-grow px-1 py-5"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 shrink-0 animate-in fade-in"
                    onClick={() => toast.info("Emoji panel active")}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sendMutation.isPending}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl px-5 h-10 transition-all shadow-md shadow-orange-500/10 active:scale-95 flex items-center gap-2 shrink-0 font-bold"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span className="hidden sm:inline text-xs font-black uppercase tracking-wider">Send</span>
                        <Send className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50/25">
                <div className="text-center p-8 space-y-4 max-w-sm transition-all duration-300 scale-100 hover:scale-[1.01]">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-orange-500/10 to-amber-500/10 border border-orange-500/20 flex items-center justify-center mx-auto shadow-md relative">
                    <div className="absolute inset-0 bg-orange-500/5 blur-md rounded-full scale-125 animate-pulse" />
                    <MessageSquare className="h-8 w-8 text-orange-500 relative z-10" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-black text-sm uppercase tracking-widest text-slate-500">Select Active Client</h4>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-[280px] mx-auto">
                      Select an active client from the side panel to load your secure collaboration sync channel.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
