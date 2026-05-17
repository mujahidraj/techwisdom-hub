/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Send, Paperclip, Smile, Search, Phone, Video,
  Reply, X, FileText, Loader2, Trash2, Pencil,
  ChevronLeft, SmilePlus, Info, CheckCircle2,
  Users, MessageCircle
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import EmojiPicker, { EmojiStyle } from 'emoji-picker-react';

const CLOUDINARY_CLOUD_NAME = "dljiukpd4";
const CLOUDINARY_PRESET = "chat_upload";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

const GENERAL_CHAT = { id: 'general', full_name: 'General Feed', avatar_url: null };

export default function Messages() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { sendNotification } = useNotifications();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && role === 'client') {
      toast.error('Access denied. Team Chat is for internal team only.');
      navigate('/client-portal');
    }
  }, [user, role, loading, navigate]);

  const [activeChat, setActiveChat] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editText, setEditText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('online-team-presence', {
      config: { presence: { key: user.id } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineUsers(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const [reactingTo, setReactingTo] = useState<string | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ['chat_users', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: rolesData } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'employee']);
      const validUserIds = rolesData?.map(r => r.user_id) || [];

      if (validUserIds.length === 0) return [];

      const { data: profiles } = await supabase.from('profiles')
        .select('id, user_id, full_name, avatar_url')
        .in('user_id', validUserIds);

      const usersWithCounts = await Promise.all((profiles || []).map(async (profile) => {
        const { count } = await supabase
          .from('team_messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_id', profile.id)
          .eq('receiver_id', user?.id)
          .not('seen_by', 'cs', `{${user?.id}}`);
        return { ...profile, unread_count: count || 0 };
      }));
      return usersWithCounts;
    }
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['team_messages', activeChat?.id || 'general', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let query = supabase.from('team_messages')
        .select(`id, content, type, file_url, sender_id, receiver_id, created_at, seen_by, reply_to, reactions, sender:profiles!team_messages_sender_id_fkey(full_name, avatar_url)`)
        .order('created_at', { ascending: true });

      if (activeChat && activeChat.id !== 'general') {
        query = query.or(`and(sender_id.eq.${user?.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${user?.id})`);
      } else {
        query = query.is('receiver_id', null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    const markAsRead = async () => {
      if (!user?.id || messages.length === 0) return;
      const unreadIds = messages.filter(msg => !msg.seen_by?.includes(user.id)).map(msg => msg.id);
      if (unreadIds.length > 0) {
        await supabase.rpc('append_seen_by', { message_ids: unreadIds, user_id: user.id });
        queryClient.invalidateQueries({ queryKey: ['unread_sidebar_count'] });
        queryClient.invalidateQueries({ queryKey: ['chat_users'] });
      }
    };
    markAsRead();
  }, [messages, activeChat, user?.id, queryClient]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('team_chat_final_v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['team_messages'] });
        queryClient.invalidateQueries({ queryKey: ['chat_users'] });
        queryClient.invalidateQueries({ queryKey: ['unread_sidebar_count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeChat, queryClient]);

  // Robust snap-to-bottom scrolling controller
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    // Snap instantly to bottom first to avoid top flashing
    scrollToBottom('auto');
    // Follow up with smooth scroll adjustment to cover late-loading media or layout recalculations
    const timer = setTimeout(() => {
      scrollToBottom('smooth');
    }, 60);
    return () => clearTimeout(timer);
  }, [messages, activeChat?.id]);

  const handleSend = async () => {
    if (!messageText.trim()) return;
    const targetId = (activeChat && activeChat.id !== 'general') ? activeChat.id : null;
    await supabase.from('team_messages').insert({
      sender_id: user?.id, receiver_id: targetId,
      content: messageText, reply_to: replyTo?.id || null, seen_by: [user?.id]
    });

    setMessageText(''); setReplyTo(null); setShowEmoji(false);
  };

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file); formData.append("upload_preset", CLOUDINARY_PRESET);
    try {
      const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
      const data = await res.json();
      if (data.secure_url) {
        const type = file.type.startsWith('image/') ? 'image' : 'file';
        const targetId = (activeChat && activeChat.id !== 'general') ? activeChat.id : null;
        await supabase.from('team_messages').insert({
          sender_id: user?.id, receiver_id: targetId,
          content: file.name, type, file_url: data.secure_url, seen_by: [user?.id]
        });
      }
    } catch (err) { toast.error("Upload failed"); } finally { setIsUploading(false); }
  };

  const handleReaction = async (msg: any, emoji: string) => {
    if (!user?.id) return;
    const currentReactions = msg.reactions || {};
    const usersForEmoji = currentReactions[emoji] || [];
    let newReactions;

    if (usersForEmoji.includes(user.id)) {
      const updatedUsers = usersForEmoji.filter((id: string) => id !== user.id);
      if (updatedUsers.length > 0) {
        newReactions = { ...currentReactions, [emoji]: updatedUsers };
      } else {
        const { [emoji]: _, ...rest } = currentReactions;
        newReactions = rest;
      }
    } else {
      newReactions = { ...currentReactions, [emoji]: [...usersForEmoji, user.id] };
    }
    setReactingTo(null);
    await supabase.from('team_messages').update({ reactions: newReactions }).eq('id', msg.id);
  };

  return (
    <DashboardLayout>
      <div className="absolute inset-0 flex overflow-hidden bg-background rounded-none border-0">

        {/* ══════════════════ SIDEBAR (Conversations list) ══════════════════ */}
        <div className={`w-full md:w-80 flex flex-col border-r border-border/40 bg-card shrink-0 z-20 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 pb-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Chats</h2>
              <div className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <Users className="h-4 w-4" />
              </div>
            </div>

            {/* Search inputs */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search Messenger..."
                className="pl-9 bg-slate-100/80 dark:bg-slate-800/80 border-0 text-xs rounded-full h-9 focus-visible:ring-1 focus-visible:ring-indigo-500 placeholder:text-slate-400"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* General Feed quick button */}
            <button
              onClick={() => setActiveChat(GENERAL_CHAT)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 ${activeChat?.id === 'general'
                  ? 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-550/15'
                  : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
            >
              <div className={`h-9 w-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${activeChat?.id === 'general' ? 'bg-white/20' : 'bg-indigo-50 dark:bg-indigo-950/45 text-indigo-500'}`}>
                <img
                  src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=100&h=100"
                  alt="TechWisdom"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-bold text-xs tracking-tight">General Feed</p>
                <p className={`text-[10px] truncate ${activeChat?.id === 'general' ? 'text-white/85' : 'text-slate-400'}`}>TechWisdom global channel</p>
              </div>
            </button>
          </div>

          {/* Active Now Stories list */}
          <div className="px-4 py-2 shrink-0 border-b border-slate-100/60 dark:border-slate-800 pb-3">
            <p className="px-1 mb-2 text-[9px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest">Active Now</p>
            <div className="flex gap-3 overflow-x-auto sidebar-scroll pb-1">
              {users.filter(u => onlineUsers.includes(u.user_id)).length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic px-1">No other team members active</p>
              ) : (
                users.filter(u => onlineUsers.includes(u.user_id)).map((u: any) => (
                  <button key={u.id} onClick={() => setActiveChat(u)} className="flex flex-col items-center gap-1 shrink-0 group focus:outline-none">
                    <div className="relative">
                      <Avatar className="h-10 w-10 border-2 border-emerald-500 p-0.5">
                        <AvatarImage src={u.avatar_url} className="rounded-full" />
                        <AvatarFallback className="bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full">
                          {u.full_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                    </div>
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 truncate w-12 text-center group-hover:text-slate-900 dark:group-hover:text-white">
                      {u.full_name.split(' ')[0]}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Conversation participants */}
          <ScrollArea className="flex-1 px-2 mt-2">
            <p className="px-3 mb-2 text-[9px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest">Participants</p>
            <div className="space-y-0.5">
              {users.filter(u => u.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setActiveChat(u)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-200 ${activeChat?.id === u.id
                      ? 'bg-slate-100/80 dark:bg-slate-800/80 shadow-sm'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/60'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-355 text-xs font-bold">
                          {u.full_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 border-2 border-white dark:border-slate-900 rounded-full ${onlineUsers.includes(u.user_id) ? 'bg-emerald-500' : 'bg-slate-350'}`} />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">
                        {u.full_name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                        {onlineUsers.includes(u.user_id) ? 'Active now' : 'Away'}
                      </p>
                    </div>
                  </div>
                  {u.unread_count > 0 && activeChat?.id !== u.id && (
                    <div className="bg-indigo-500 text-white text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full shadow-md shrink-0">
                      {u.unread_count}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* ══════════════════ CHAT WINDOW (Active Chat Area) ══════════════════ */}
        <div className={`flex-1 flex flex-col bg-background overflow-hidden ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
            <>
              {/* Chat Header (Frosted Glassmorphism) */}
              <div className="h-14 px-4 md:px-6 border-b border-border/40 flex justify-between items-center bg-card z-10 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-8 w-8 -ml-1 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100/50"
                    onClick={() => setActiveChat(null)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  <div className="relative">
                    <Avatar className={`h-9 w-9 border ${activeChat?.id === 'general' ? 'border-purple-200' : 'border-slate-200'}`}>
                      {activeChat?.id === 'general' ? (
                        <AvatarImage src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=100&h=100" className="object-cover" />
                      ) : (
                        <AvatarImage src={activeChat?.avatar_url} />
                      )}
                      <AvatarFallback className={`${activeChat?.id === 'general' ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white' : 'bg-indigo-100 text-indigo-800'} text-xs font-black`}>
                        {activeChat?.id === 'general' ? 'TW' : activeChat?.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {activeChat?.id !== 'general' && onlineUsers.includes(activeChat?.user_id) && (
                      <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-955" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {activeChat.full_name}
                    </h3>
                    {activeChat?.id !== 'general' ? (
                      <p className={`text-[9px] font-bold uppercase tracking-widest ${onlineUsers.includes(activeChat?.user_id) ? 'text-emerald-500' : 'text-slate-450'}`}>
                        {onlineUsers.includes(activeChat?.user_id) ? 'Active now' : 'Offline'}
                      </p>
                    ) : (
                      <p className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest flex items-center gap-1">
                        <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-pulse" />
                        Team Workspace
                      </p>
                    )}
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-500 rounded-full h-8 w-8 hover:bg-slate-100/60 dark:hover:bg-slate-800/60" onClick={() => navigate('/meeting')}><Phone className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-500 rounded-full h-8 w-8 hover:bg-slate-100/60 dark:hover:bg-slate-800/60" onClick={() => navigate('/meeting')}><Video className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-500 rounded-full h-8 w-8 hover:bg-slate-100/60 dark:hover:bg-slate-800/60"><Info className="h-4 w-4" /></Button>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-4 md:px-6 relative w-full bg-background sidebar-scroll scroll-smooth"
              >
                <div className="max-w-4xl mx-auto py-6 pb-2 w-full">

                  {/* Beautiful Messenger Greeting Hero Block */}
                  <div className="flex flex-col items-center justify-center text-center py-10 mb-8 border-b border-slate-150/40 dark:border-slate-800/40 animate-fade-in">
                    <div className="relative mb-3">
                      <Avatar className="h-16 w-16 border-4 border-white dark:border-slate-800 shadow-xl">
                        {activeChat?.id === 'general' ? (
                          <AvatarImage src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=100&h=100" />
                        ) : (
                          <AvatarImage src={activeChat?.avatar_url} />
                        )}
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xl font-bold">
                          {activeChat?.id === 'general' ? 'TW' : activeChat?.full_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {activeChat?.id !== 'general' && onlineUsers.includes(activeChat?.id) && (
                        <div className="absolute bottom-0 right-0 h-4 w-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{activeChat.full_name}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[280px] leading-relaxed font-semibold">
                      {activeChat?.id === 'general'
                        ? 'This is the official global channel for all TechWisdom team members.'
                        : `You are connected with ${activeChat.full_name}. Say hello to start your direct line.`}
                    </p>
                  </div>

                  {/* Messages Feed */}
                  {messages.length === 0 ? (
                    <div className="text-center py-10 text-slate-450">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30 animate-bounce" />
                      <p className="text-xs font-bold">No messages here yet</p>
                      <p className="text-[9px] opacity-70 mt-0.5">Send a message below to break the ice!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg: any) => {
                        const isMe = msg.sender_id === user?.id;
                        const isEditing = editingMessage === msg.id;
                        const repliedMsg = msg.reply_to ? messages.find((m: any) => m.id === msg.reply_to) : null;
                        const reactions = msg.reactions || {};

                        return (
                          <div key={msg.id} className={`flex gap-2.5 items-end ${isMe ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300 w-full mb-3`}>

                            {/* Receiver Avatar displayed next to their bubble */}
                            {!isMe && (
                              <Avatar className="h-7 w-7 border shrink-0">
                                <AvatarImage src={msg.sender?.avatar_url} />
                                <AvatarFallback className="bg-slate-100 text-slate-800 text-[10px] font-bold">
                                  {msg.sender?.full_name?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                            )}

                            {/* MESSAGE CONTAINER - FIXED RESPONSIVE WIDTH */}
                            <div className={`max-w-[75%] md:max-w-[65%] min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>

                              {!isMe && activeChat?.id === 'general' && (
                                <span className="text-[9px] font-extrabold text-slate-450 mb-1 ml-1 tracking-tight">
                                  {msg.sender?.full_name}
                                </span>
                              )}

                              {/* Reply Indicator Bubble */}
                              {repliedMsg && (
                                <div className={`mb-1 px-3 py-1 rounded-xl text-[10px] border-l-2 bg-slate-150/60 dark:bg-slate-800/60 opacity-85 max-w-full truncate ${isMe ? 'self-end mr-1 border-indigo-500' : 'self-start ml-1 border-slate-400'}`}>
                                  <span className="font-bold opacity-75">Replying to: </span>
                                  <span className="italic">{repliedMsg.content?.substring(0, 30)}...</span>
                                </div>
                              )}

                              {/* TEXT BUBBLE - Messenger Rounded Gradient Corner Design */}
                              <div className={`px-4 py-2.5 rounded-2xl transition-all shadow-sm break-words break-all whitespace-pre-wrap relative ${isMe
                                ? 'bg-gradient-to-br from-indigo-500 via-blue-600 to-sky-500 text-white rounded-br-sm shadow-md shadow-blue-500/10'
                                : 'bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-150/50 dark:border-slate-800/80 shadow-sm'
                                }`}>
                                {isEditing ? (
                                  <div className="flex flex-col gap-2 min-w-[200px]">
                                    <Input className="bg-white/80 dark:bg-slate-900 border-none h-8 text-xs text-slate-900 dark:text-white focus-visible:ring-1 focus-visible:ring-indigo-500" value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
                                    <div className="flex justify-end gap-2">
                                      <button className="text-[9px] font-bold opacity-60 dark:text-slate-400" onClick={() => setEditingMessage(null)}>Cancel</button>
                                      <button className="text-[9px] font-bold bg-indigo-500 text-white px-2 py-0.5 rounded-md shadow-sm" onClick={async () => { await supabase.from('team_messages').update({ content: editText }).eq('id', msg.id); setEditingMessage(null); queryClient.invalidateQueries({ queryKey: ['team_messages'] }); }}>Save</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {msg.type === 'text' && <p className="text-[12.5px] leading-relaxed font-semibold tracking-tight">{msg.content}</p>}
                                    {msg.type === 'image' && <img src={msg.file_url} className="rounded-xl max-h-60 w-full object-cover cursor-pointer shadow-sm border-2 border-white dark:border-slate-800" onClick={() => window.open(msg.file_url)} />}
                                    {msg.type === 'file' && <a href={msg.file_url} target="_blank" className={`flex items-center gap-2 p-2 rounded-xl bg-black/5 text-[11px] font-semibold no-underline ${isMe ? 'text-white' : 'text-indigo-600'}`}><FileText className="h-4 w-4" />{msg.content}</a>}
                                  </>
                                )}
                                <div className={`text-[8px] mt-1 font-extrabold opacity-50 text-right uppercase tracking-tighter ${isMe ? 'text-white/85' : 'text-slate-400'}`}>{format(new Date(msg.created_at), 'h:mm a')}</div>

                                {/* Reactions Pill overlay */}
                                {Object.keys(reactions).length > 0 && (
                                  <div className={`absolute -bottom-3 ${isMe ? 'right-1.5' : 'left-1.5'} flex gap-1 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-full px-2 py-0.5 shadow-md z-30 transition-transform hover:scale-105`}>
                                    {Object.entries(reactions).map(([emoji, users]: [string, any]) => (
                                      <button key={emoji} onClick={() => handleReaction(msg, emoji)} className={`text-[9px] flex items-center gap-0.5 hover:scale-125 transition-transform ${users.includes(user?.id) ? 'bg-indigo-50 dark:bg-indigo-950/45 rounded px-1' : ''}`}>
                                        <span>{emoji}</span> <span className="text-[8px] font-bold text-slate-450">{users.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Hover Action bar inside stream */}
                              <div className={`absolute -top-3 ${isMe ? '-left-8' : '-right-8'} hidden group-hover:flex items-center gap-1 bg-white dark:bg-slate-900 backdrop-blur rounded-full p-1 border dark:border-slate-800 shadow-sm z-20`}>
                                <button className="p-1 text-slate-455 hover:text-amber-500 relative rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}>
                                  <SmilePlus className="h-3.5 w-3.5" />
                                  {reactingTo === msg.id && (
                                    <div className="absolute bottom-8 -left-20 z-50">
                                      <EmojiPicker
                                        onEmojiClick={(e) => handleReaction(msg, e.emoji)}
                                        emojiStyle={EmojiStyle.NATIVE}
                                        width={250}
                                        height={300}
                                        searchDisabled
                                        skinTonesDisabled
                                      />
                                    </div>
                                  )}
                                </button>
                                <button className="p-1 text-slate-455 hover:text-indigo-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setReplyTo(msg)}><Reply className="h-3.5 w-3.5" /></button>
                                {isMe && (
                                  <>
                                    <button className="p-1 text-slate-455 hover:text-blue-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { setEditingMessage(msg.id); setEditText(msg.content); }}><Pencil className="h-3.5 w-3.5" /></button>
                                    <button className="p-1 text-slate-455 hover:text-red-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={async () => { await supabase.from('team_messages').delete().eq('id', msg.id); queryClient.invalidateQueries({ queryKey: ['team_messages'] }); }}><Trash2 className="h-3.5 w-3.5" /></button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={scrollRef} />
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Input box - floating messenger capsule style */}
              <div className="p-4 bg-transparent shrink-0">
                <div className="max-w-4xl mx-auto">
                  {replyTo && (
                    <div className="mb-2 p-2 bg-white dark:bg-slate-900 border-l-2 border-indigo-500 text-[10px] flex justify-between items-center rounded-xl animate-in slide-in-from-bottom-2 shadow-sm border border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-500 italic truncate">Replying to: {replyTo.content}</span>
                      <button onClick={() => setReplyTo(null)}><X className="h-3 w-3 text-slate-400" /></button>
                    </div>
                  )}

                  {/* Floating Frosted Glass Capsule */}
                  <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg p-2.5 pl-4 pr-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/85 shadow-lg shadow-slate-100/40 dark:shadow-none focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white dark:focus-within:bg-slate-950 transition-all">

                    {/* Emoji Trigger */}
                    <div className="relative shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-500 rounded-full hover:bg-slate-200/50" onClick={() => setShowEmoji(!showEmoji)}>
                        <Smile className="h-5 w-5" />
                      </Button>
                      {showEmoji && (
                        <div className="absolute bottom-12 left-0 z-50 animate-in fade-in zoom-in-95">
                          <EmojiPicker
                            onEmojiClick={(e) => { setMessageText(prev => prev + e.emoji); }}
                            emojiStyle={EmojiStyle.NATIVE}
                            width={280}
                            height={350}
                            previewConfig={{ showPreview: false }}
                          />
                        </div>
                      )}
                    </div>

                    {/* File Attachment Trigger */}
                    <div className="relative shrink-0">
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-500 rounded-full hover:bg-slate-200/50">
                        {isUploading ? <Loader2 className="animate-spin h-4 w-4" /> : <Paperclip className="h-5 w-5" />}
                      </Button>
                    </div>

                    {/* Message input */}
                    <Input
                      className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-slate-800 dark:text-white placeholder:text-slate-450 font-bold text-xs h-9 p-0"
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={e => setMessageText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />

                    {/* Send button */}
                    <Button
                      onClick={handleSend}
                      className="rounded-xl h-8 w-8 shrink-0 bg-indigo-500 hover:bg-indigo-600 shadow-md shadow-indigo-550/15 hover:scale-[1.05] transition-transform p-0 flex items-center justify-center"
                      disabled={!messageText.trim()}
                    >
                      <Send className="h-3.5 w-3.5 text-white" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-450 dark:text-slate-500 p-6 bg-background">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/45 text-indigo-500 rounded-3xl mb-4 shadow-sm border border-slate-100/50 dark:border-slate-800">
                <Users className="h-8 w-8 opacity-75" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-350">Select a Conversation</p>
              <p className="text-[10px] text-muted-foreground mt-1 max-w-[240px] text-center">
                Select a team member or the general chat channel from the left sidebar to start messaging.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}