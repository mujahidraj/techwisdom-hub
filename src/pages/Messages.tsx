/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Send, Paperclip, Smile, Search, Phone, Video, 
  Reply, X, FileText, Loader2, Trash2, Pencil, Hash, 
  MoreHorizontal
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CLOUDINARY_CLOUD_NAME = "dljiukpd4"; 
const CLOUDINARY_PRESET = "chat_upload"; 
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
const QUICK_EMOJIS = ["😀", "😂", "❤️", "👍", "🙌", "🔥", "✨", "✅"];

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [activeChat, setActiveChat] = useState<any>(null); 
  const [messageText, setMessageText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editText, setEditText] = useState('');

  // 1. Fetch Users + Precision Individual Unseen Logic
  const { data: users = [] } = useQuery({
    queryKey: ['chat_users', user?.id],
    enabled: !!user?.id, 
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').neq('id', user?.id);
      
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

  // 2. Fetch Messages
  const { data: messages = [] } = useQuery({
    queryKey: ['team_messages', activeChat?.id || 'general', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let query = supabase.from('team_messages')
        .select(`id, content, type, file_url, sender_id, receiver_id, created_at, seen_by, reply_to, sender:profiles!team_messages_sender_id_fkey(full_name, avatar_url)`)
        .order('created_at', { ascending: true });

      if (activeChat) {
        query = query.or(`and(sender_id.eq.${user?.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${user?.id})`);
      } else {
        query = query.is('receiver_id', null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // 3. Mark as Read Logic
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

  // 4. Realtime Synchronization
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('team_chat_final_v3')
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
    await supabase.from('team_messages').insert({ 
      sender_id: user?.id, receiver_id: activeChat?.id || null, 
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
            await supabase.from('team_messages').insert({ 
              sender_id: user?.id, receiver_id: activeChat?.id || null, 
              content: file.name, type, file_url: data.secure_url, seen_by: [user?.id]
            });
        }
    } catch (err) { toast.error("Upload failed"); } finally { setIsUploading(false); }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-80px)] gap-0 -m-6 overflow-hidden bg-white">
        
        {/* COMPACT SIDEBAR */}
        <div className="w-72 flex flex-col border-r border-slate-100 bg-[#fbfcfd] z-20">
          <div className="p-6 pb-2">
            <h2 className="text-xl font-bold text-slate-900 mb-4 px-2">Messages</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input placeholder="Search..." className="pl-9 bg-slate-200/40 border-none rounded-xl h-9 text-xs" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            <button onClick={() => setActiveChat(null)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${!activeChat ? 'bg-white shadow-sm ring-1 ring-slate-200 text-primary' : 'hover:bg-slate-200/50 text-slate-500'}`}>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${!activeChat ? 'bg-primary text-white' : 'bg-slate-200'}`}>
                <Hash className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm">General Feed</span>
            </button>
          </div>
          
          <ScrollArea className="flex-1 px-4 mt-2">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">People</p>
            <div className="space-y-1">
              {users.filter(u => u.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map((u: any) => (
                <button key={u.id} onClick={() => setActiveChat(u)} className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all group ${activeChat?.id === u.id ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-200/30'}`}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10 border border-white shadow-sm"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.full_name?.charAt(0)}</AvatarFallback></Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-white rounded-full" />
                    </div>
                    <div className="text-left">
                      <p className={`font-bold text-sm truncate w-32 ${activeChat?.id === u.id ? 'text-slate-900' : 'text-slate-600'}`}>{u.full_name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Active</p>
                    </div>
                  </div>
                  {u.unread_count > 0 && activeChat?.id !== u.id && (
                    <div className="bg-red-500 text-white text-[10px] font-black h-5 w-5 flex items-center justify-center rounded-full animate-bounce shadow-lg shadow-red-200">
                      {u.unread_count}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* MASSIVE CHAT WINDOW */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          
          {/* Header */}
          <div className="h-16 px-8 border-b border-slate-100 flex justify-between items-center bg-white/90 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-slate-100"><AvatarImage src={activeChat?.avatar_url} /><AvatarFallback className="bg-primary/5 text-primary">#</AvatarFallback></Avatar>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{activeChat ? activeChat.full_name : 'Team General'}</h3>
                <p className="text-[10px] text-green-500 font-medium uppercase tracking-widest">Live Sync</p>
              </div>
            </div>
            <div className="flex gap-1">
               <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-full" onClick={() => navigate('/meeting')}><Phone className="h-4 w-4"/></Button>
               <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-full" onClick={() => navigate('/meeting')}><Video className="h-4 w-4"/></Button>
               <Button variant="ghost" size="icon" className="text-slate-400 rounded-full"><MoreHorizontal className="h-4 w-4"/></Button>
            </div>
          </div>

          {/* Messages Area - Subtle Patterned Background */}
          <ScrollArea 
            className="flex-1 px-8 py-6 relative"
            style={{
              backgroundColor: '#fdfdfe',
              backgroundImage: `url("https://www.transparenttextures.com/patterns/cubes.png")`,
              backgroundOpacity: 0.05
            }}
          >
            <div className="max-w-4xl mx-auto space-y-3"> {/* Reduced spacing to space-y-3 for more density */}
              {messages.map((msg: any) => {
                const isMe = msg.sender_id === user?.id;
                const isEditing = editingMessage === msg.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-in slide-in-from-bottom-1`}>
                    <div className={`max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>
                      {!isMe && !activeChat && <span className="text-[10px] font-bold text-slate-400 mb-0.5 ml-2">{msg.sender?.full_name}</span>}
                      
                      <div className={`px-4 py-2 rounded-2xl transition-all shadow-sm ${
                        isMe 
                          ? 'bg-primary text-white rounded-tr-none shadow-md shadow-primary/10' 
                          : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm'
                      }`}>
                        {isEditing ? (
                            <div className="flex flex-col gap-2 min-w-[200px]">
                                <Input className="bg-slate-50 border-none h-8 text-sm text-slate-900" value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
                                <div className="flex justify-end gap-2">
                                    <button className="text-[10px] font-bold opacity-60" onClick={() => setEditingMessage(null)}>Cancel</button>
                                    <button className="text-[10px] font-bold bg-white text-primary px-2 py-1 rounded shadow-sm" onClick={async () => { await supabase.from('team_messages').update({ content: editText }).eq('id', msg.id); setEditingMessage(null); queryClient.invalidateQueries({ queryKey: ['team_messages'] }); }}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {msg.type === 'text' && <p className="text-[14px] leading-relaxed font-medium">{msg.content}</p>}
                                {msg.type === 'image' && <img src={msg.file_url} className="rounded-xl max-h-80 cursor-pointer shadow-md border-2 border-white" onClick={() => window.open(msg.file_url)} />}
                                {msg.type === 'file' && <a href={msg.file_url} target="_blank" className={`flex items-center gap-2 p-2 rounded-lg bg-black/5 text-[13px] font-medium no-underline ${isMe ? 'text-white' : 'text-primary'}`}><FileText className="h-4 w-4"/>{msg.content}</a>}
                            </>
                        )}
                        <div className={`text-[8px] mt-0.5 font-bold opacity-40 text-right uppercase tracking-tighter ${isMe ? 'text-white' : 'text-slate-400'}`}>{format(new Date(msg.created_at), 'h:mm a')}</div>
                      </div>

                      <div className={`absolute top-0 ${isMe ? '-left-12' : '-right-12'} hidden group-hover:flex items-center gap-1 bg-white/80 backdrop-blur rounded-full p-1 border shadow-sm`}>
                          <button className="p-1 text-slate-400 hover:text-primary transition-all" onClick={() => setReplyTo(msg)}><Reply className="h-3 w-3"/></button>
                          {isMe && (
                              <>
                                <button className="p-1 text-slate-400 hover:text-amber-500 transition-all" onClick={() => { setEditingMessage(msg.id); setEditText(msg.content); }}><Pencil className="h-3 w-3"/></button>
                                <button className="p-1 text-slate-400 hover:text-red-500 transition-all" onClick={async () => { await supabase.from('team_messages').delete().eq('id', msg.id); queryClient.invalidateQueries({ queryKey: ['team_messages'] }); }}><Trash2 className="h-3 w-3"/></button>
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

          {/* Input Bar - Shifted Send Button to the Left */}
          <div className="p-6 bg-white border-t border-slate-50">
            <div className="max-w-4xl mx-auto">
              {replyTo && (
                <div className="mb-2 p-2 bg-slate-50 border-l-2 border-primary text-[10px] flex justify-between items-center rounded-lg">
                  <span className="text-slate-500 italic">Replying: {replyTo.content?.substring(0, 50)}...</span>
                  <button onClick={() => setReplyTo(null)}><X className="h-3 w-3 text-slate-400"/></button>
                </div>
              )}
              {/* Added padding-right to the container to move the send button away from the edge */}
              <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 pl-4 pr-10 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:shadow-xl transition-all">
                  <div className="relative">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary rounded-lg" onClick={() => setShowEmoji(!showEmoji)}><Smile className="h-5 w-5"/></Button>
                    {showEmoji && (
                      <div className="absolute bottom-12 left-0 bg-white border border-slate-100 rounded-xl p-2 shadow-2xl flex gap-2 animate-in fade-in zoom-in-95 z-50">
                          {QUICK_EMOJIS.map(e => ( <button key={e} onClick={() => {setMessageText(prev => prev + e); setShowEmoji(false);}} className="hover:scale-150 transition-transform p-1 text-xl">{e}</button> ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading}/>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary rounded-lg">{isUploading ? <Loader2 className="animate-spin h-4 w-4"/> : <Paperclip className="h-5 w-5"/>}</Button>
                  </div>
                  
                  <Input 
                    className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-slate-700 placeholder:text-slate-400 font-medium h-10" 
                    placeholder="Message..." 
                    value={messageText} 
                    onChange={e => setMessageText(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                  />
                  {/* Shifted button using margin-right if needed, but added padding-right to container instead */}
                  <Button onClick={handleSend} className="rounded-xl h-9 w-9 bg-primary shadow-lg shadow-primary/20 hover:scale-105 transition-transform p-0 mr-2" disabled={!messageText.trim()}>
                    <Send className="h-4 w-4"/>
                  </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}