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
  Reply, X, FileText, Loader2, Trash2, Pencil, Hash,
  MoreHorizontal, ChevronLeft, SmilePlus, AlertTriangle
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
        .select('id, full_name, avatar_url')
        .in('id', validUserIds);

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

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
      <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden bg-white rounded-lg border border-slate-100 shadow-sm">

        {/* SIDEBAR */}
        <div className={`w-full md:w-64 flex-col border-r border-slate-100 bg-[#f8f9fa] z-20 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 md:p-6 pb-2">
            <h2 className="text-lg font-black text-slate-800 mb-4 tracking-tight">Messages</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-3 w-3 text-slate-400" />
              <Input placeholder="Search..." className="pl-8 bg-white border-slate-200 rounded-lg h-8 text-[11px]" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            <button 
              onClick={() => setActiveChat(GENERAL_CHAT)} 
              className={`w-full flex items-center gap-2 p-2.5 rounded-xl transition-all duration-300 ${
                activeChat?.id === 'general' 
                ? 'bg-gradient-to-r from-[#C00707] to-[#FF4400] text-white shadow-lg shadow-red-200 scale-[1.02]' 
                : 'hover:bg-red-50 text-slate-600'
              }`}
            >
              <div className={`h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center ${activeChat?.id === 'general' ? 'bg-white/20' : 'bg-red-50'}`}>
                <img 
                  src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=100&h=100" 
                  alt="TechWisdom" 
                  className="h-full w-full object-cover opacity-90"
                />
              </div>
              <span className="font-black text-xs tracking-tight">General Feed</span>
            </button>
          </div>

          <ScrollArea className="flex-1 px-3 mt-2">
            <p className="px-3 mb-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">People</p>
            <div className="space-y-1">
              {users.filter(u => u.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map((u: any) => (
                <button 
                  key={u.id} 
                  onClick={() => setActiveChat(u)} 
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all duration-300 ${
                    activeChat?.id === u.id 
                    ? 'bg-[#134E8E] text-white shadow-lg shadow-blue-200 scale-[1.02]' 
                    : 'hover:bg-blue-50 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <Avatar className={`h-8 w-8 border-2 ${activeChat?.id === u.id ? 'border-white/30' : 'border-white'}`}>
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className={`${activeChat?.id === u.id ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'} text-[10px] font-black`}>
                          {u.full_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 border-2 ${activeChat?.id === u.id ? 'border-[#134E8E]' : 'border-[#f8f9fa]'} rounded-full ${onlineUsers.includes(u.id) ? 'bg-green-400' : 'bg-slate-300'}`} />
                    </div>
                    <p className={`font-black text-xs tracking-tight truncate w-24 ${activeChat?.id === u.id ? 'text-white' : 'text-slate-700'}`}>
                      {u.full_name}
                    </p>
                  </div>
                  {u.unread_count > 0 && activeChat?.id !== u.id && (
                    <div className="bg-red-500 text-white text-[9px] font-black h-4 w-4 flex items-center justify-center rounded-full animate-pulse shadow-sm">
                      {u.unread_count}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* CHAT WINDOW */}
        <div className={`flex-1 flex flex-col bg-white overflow-hidden ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="h-14 px-4 md:px-8 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-10 shrink-0">
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 -ml-2 mr-1 text-slate-500"
                onClick={() => setActiveChat(null)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <div className="relative">
                <Avatar className={`h-9 w-9 border-2 ${activeChat?.id === 'general' ? 'border-red-200' : 'border-blue-200'}`}>
                  {activeChat?.id === 'general' ? (
                    <AvatarImage src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=100&h=100" className="object-cover" />
                  ) : (
                    <AvatarImage src={activeChat?.avatar_url} />
                  )}
                  <AvatarFallback className={`${activeChat?.id === 'general' ? 'bg-gradient-to-br from-[#C00707] to-[#FF4400] text-white' : 'bg-[#134E8E] text-white'} text-xs font-black`}>
                    {activeChat?.id === 'general' ? 'TW' : activeChat?.full_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
                <h3 className={`font-black text-xs tracking-tight ${activeChat?.id === 'general' ? 'text-red-900' : 'text-blue-900'}`}>
                  {activeChat ? activeChat.full_name : 'TechWisdom Feed'}
                </h3>
                {activeChat?.id !== 'general' && (
                  <p className={`text-[9px] font-black uppercase tracking-widest ${onlineUsers.includes(activeChat?.id) ? 'text-blue-500' : 'text-slate-400'}`}>
                    {onlineUsers.includes(activeChat?.id) ? 'Active Now' : 'Offline'}
                  </p>
                )}
                {activeChat?.id === 'general' && (
                  <p className="text-[9px] text-red-600 font-black uppercase tracking-widest flex items-center gap-1">
                    <span className="h-1 w-1 bg-red-600 rounded-full animate-pulse" />
                    TechWisdom Network
                  </p>
                )}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-lg h-8 w-8" onClick={() => navigate('/meeting')}><Phone className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-lg h-8 w-8" onClick={() => navigate('/meeting')}><Video className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="text-slate-300 rounded-lg h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea
            className="flex-1 px-4 md:px-8 py-6 relative w-full"
            style={{
              backgroundColor: '#fcfdfe',
              backgroundImage: `url("https://www.transparenttextures.com/patterns/cubes.png")`,
              backgroundSize: '150px'
            }}
          >
            <div className="max-w-5xl mx-auto space-y-4 pb-4 w-full">
              {messages.map((msg: any) => {
                const isMe = msg.sender_id === user?.id;
                const isEditing = editingMessage === msg.id;
                const repliedMsg = msg.reply_to ? messages.find((m: any) => m.id === msg.reply_to) : null;
                const reactions = msg.reactions || {};

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-1 w-full`}>

                    {/* MESSAGE CONTAINER - FIXED RESPONSIVE WIDTH */}
                    {/* w-full ensures it doesn't collapse. max-w-[80%] prevents edge touching on mobile. */}
                    <div className={`max-w-[80%] md:max-w-[75%] min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>

                      {!isMe && !activeChat && <span className="text-[9px] font-bold text-slate-400 mb-0.5 ml-2">{msg.sender?.full_name}</span>}

                      {/* Reply Bubble */}
                      {repliedMsg && (
                        <div className={`mb-1 px-3 py-1 rounded-lg text-[10px] border-l-2 bg-slate-50 opacity-70 max-w-full truncate ${isMe ? 'self-end mr-1 border-primary/50' : 'self-start ml-1 border-slate-400'}`}>
                          <span className="font-bold opacity-70">Replying to: </span>
                          <span className="italic">{repliedMsg.content?.substring(0, 30)}...</span>
                        </div>
                      )}

                      {/* MESSAGE TEXT BUBBLE - FIXED CLIPPING */}
                      {/* break-all forces long words to break. break-words handles normal text. */}
                      <div className={`px-3 py-2 rounded-xl transition-all shadow-sm break-words break-all whitespace-pre-wrap relative ${isMe
                        ? 'bg-primary text-white rounded-tr-none shadow-primary/10'
                        : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm'
                        }`}>
                        {isEditing ? (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <Input className="bg-slate-50 border-none h-8 text-xs text-slate-900" value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
                            <div className="flex justify-end gap-2">
                              <button className="text-[9px] font-bold opacity-60" onClick={() => setEditingMessage(null)}>Cancel</button>
                              <button className="text-[9px] font-bold bg-white text-primary px-2 py-0.5 rounded shadow-sm" onClick={async () => { await supabase.from('team_messages').update({ content: editText }).eq('id', msg.id); setEditingMessage(null); queryClient.invalidateQueries({ queryKey: ['team_messages'] }); }}>Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {msg.type === 'text' && <p className="text-[13px] leading-relaxed font-medium">{msg.content}</p>}
                            {msg.type === 'image' && <img src={msg.file_url} className="rounded-lg max-h-64 w-full object-cover cursor-pointer shadow-sm border-2 border-white" onClick={() => window.open(msg.file_url)} />}
                            {msg.type === 'file' && <a href={msg.file_url} target="_blank" className={`flex items-center gap-2 p-2 rounded-lg bg-black/5 text-[12px] font-medium no-underline ${isMe ? 'text-white' : 'text-primary'}`}><FileText className="h-4 w-4" />{msg.content}</a>}
                          </>
                        )}
                        <div className={`text-[9px] mt-1 font-bold opacity-50 text-right uppercase tracking-tighter ${isMe ? 'text-white' : 'text-slate-400'}`}>{format(new Date(msg.created_at), 'h:mm a')}</div>

                        {/* REACTIONS */}
                        {Object.keys(reactions).length > 0 && (
                          <div className={`absolute -bottom-3 ${isMe ? 'right-0' : 'left-0'} flex gap-1 bg-white border border-slate-100 rounded-full px-1.5 py-0.5 shadow-sm z-30`}>
                            {Object.entries(reactions).map(([emoji, users]: [string, any]) => (
                              <button key={emoji} onClick={() => handleReaction(msg, emoji)} className={`text-[10px] flex items-center gap-0.5 hover:scale-125 transition-transform ${users.includes(user?.id) ? 'bg-primary/10 rounded px-1' : ''}`}>
                                <span>{emoji}</span> <span className="text-[8px] font-bold text-slate-400">{users.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* HOVER ACTIONS */}
                      <div className={`absolute -top-3 ${isMe ? '-left-8' : '-right-8'} hidden group-hover:flex items-center gap-1 bg-white/90 backdrop-blur rounded-full p-1 border shadow-sm z-20`}>
                        <button className="p-1 text-slate-400 hover:text-amber-500 relative" onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}>
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
                        <button className="p-1 text-slate-400 hover:text-primary" onClick={() => setReplyTo(msg)}><Reply className="h-3.5 w-3.5" /></button>
                        {isMe && (
                          <>
                            <button className="p-1 text-slate-400 hover:text-blue-500" onClick={() => { setEditingMessage(msg.id); setEditText(msg.content); }}><Pencil className="h-3.5 w-3.5" /></button>
                            <button className="p-1 text-slate-400 hover:text-red-500" onClick={async () => { await supabase.from('team_messages').delete().eq('id', msg.id); queryClient.invalidateQueries({ queryKey: ['team_messages'] }); }}><Trash2 className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* INPUT AREA */}
          <div className="p-3 md:p-6 bg-white border-t border-slate-50 z-20 shrink-0">
            <div className="max-w-4xl mx-auto">
              {replyTo && (
                <div className="mb-2 p-2 bg-slate-50 border-l-2 border-primary text-[10px] flex justify-between items-center rounded-lg animate-in slide-in-from-bottom-2">
                  <span className="text-slate-500 italic truncate">Replying to: {replyTo.content}</span>
                  <button onClick={() => setReplyTo(null)}><X className="h-3 w-3 text-slate-400" /></button>
                </div>
              )}
              <div className="flex items-center gap-2 md:gap-3 bg-slate-100/50 p-1.5 pl-3 md:pl-4 pr-3 md:pr-12 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:shadow-2xl transition-all">
                <div className="relative">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary rounded-lg" onClick={() => setShowEmoji(!showEmoji)}><Smile className="h-5 w-5" /></Button>

                  {showEmoji && (
                    <div className="absolute bottom-12 left-0 z-50 animate-in fade-in zoom-in-95">
                      <EmojiPicker
                        onEmojiClick={(e) => { setMessageText(prev => prev + e.emoji); }}
                        emojiStyle={EmojiStyle.NATIVE}
                        width={300}
                        height={400}
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  )}
                </div>

                <div className="relative">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary rounded-lg">{isUploading ? <Loader2 className="animate-spin h-4 w-4" /> : <Paperclip className="h-5 w-5" />}</Button>
                </div>

                <Input className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-slate-800 placeholder:text-slate-400 font-bold text-sm h-10" placeholder="Message..." value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />

                <Button onClick={handleSend} className="rounded-xl h-8 w-8 bg-primary shadow-lg shadow-primary/20 hover:scale-[1.05] transition-transform p-0" disabled={!messageText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}