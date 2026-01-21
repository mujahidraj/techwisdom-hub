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

// Updated: Soft iPhone-style notification sound (Short, high-pitched chime)
const IPHONE_NOTIFY_SOUND = "/public/techwidom-noti.mp3";

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

  // 1. Fetch Users + Precision Unseen Logic
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

  // 3. Mark as Read Logic (Instantly clears notifications)
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

  // 4. Realtime Listener
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
        <div className="w-64 flex flex-col border-r border-slate-100 bg-[#f8f9fa] z-20">
          <div className="p-6 pb-2">
            <h2 className="text-lg font-black text-slate-800 mb-4 tracking-tight">Messages</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-3 w-3 text-slate-400" />
              <Input placeholder="Search..." className="pl-8 bg-white border-slate-200 rounded-lg h-8 text-[11px]" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            <button onClick={() => setActiveChat(null)} className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all duration-200 ${!activeChat ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-200 text-slate-500'}`}>
              <Hash className="h-4 w-4" />
              <span className="font-bold text-xs">General Feed</span>
            </button>
          </div>
          
          <ScrollArea className="flex-1 px-3 mt-2">
            <p className="px-3 mb-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">People</p>
            <div className="space-y-1">
              {users.filter(u => u.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map((u: any) => (
                <button key={u.id} onClick={() => setActiveChat(u)} className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${activeChat?.id === u.id ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-200/50'}`}>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Avatar className="h-8 w-8 border border-white"><AvatarImage src={u.avatar_url} /><AvatarFallback className="text-[10px]">{u.full_name?.charAt(0)}</AvatarFallback></Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 border-2 border-[#f8f9fa] rounded-full" />
                    </div>
                    <p className={`font-bold text-xs truncate w-24 ${activeChat?.id === u.id ? 'text-slate-900' : 'text-slate-600'}`}>{u.full_name}</p>
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

        {/* MASSIVE CHAT WINDOW */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="h-14 px-8 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border border-slate-100"><AvatarImage src={activeChat?.avatar_url} /><AvatarFallback className="bg-primary/5 text-primary text-[10px]">#</AvatarFallback></Avatar>
              <div>
                <h3 className="font-bold text-slate-900 text-xs">{activeChat ? activeChat.full_name : 'Team General'}</h3>
                <p className="text-[9px] text-green-500 font-bold uppercase tracking-widest">Active Now</p>
              </div>
            </div>
            <div className="flex gap-1">
               <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-lg h-8 w-8" onClick={() => navigate('/meeting')}><Phone className="h-4 w-4"/></Button>
               <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-lg h-8 w-8" onClick={() => navigate('/meeting')}><Video className="h-4 w-4"/></Button>
               <Button variant="ghost" size="icon" className="text-slate-300 rounded-lg h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button>
            </div>
          </div>

          {/* Messages Area - Light Textured Background */}
          <ScrollArea 
            className="flex-1 px-8 py-6 relative"
            style={{
              backgroundColor: '#fcfdfe',
              backgroundImage: `url("https://www.transparenttextures.com/patterns/cubes.png")`,
              backgroundSize: '150px'
            }}
          >
            <div className="max-w-5xl mx-auto space-y-2"> {/* Tight spacing for 1-line messages */}
              {messages.map((msg: any) => {
                const isMe = msg.sender_id === user?.id;
                const isEditing = editingMessage === msg.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-1`}>
                    <div className={`max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>
                      {!isMe && !activeChat && <span className="text-[9px] font-bold text-slate-400 mb-0.5 ml-2">{msg.sender?.full_name}</span>}
                      
                      <div className={`px-3 py-1.5 rounded-xl transition-all shadow-sm ${
                        isMe 
                          ? 'bg-primary text-white rounded-tr-none shadow-primary/10' 
                          : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm'
                      }`}>
                        {isEditing ? (
                          <div className="flex flex-col gap-2 min-w-[150px]">
                            <Input className="bg-slate-50 border-none h-7 text-xs text-slate-900" value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
                            <div className="flex justify-end gap-2">
                              <button className="text-[9px] font-bold opacity-60" onClick={() => setEditingMessage(null)}>Cancel</button>
                              <button className="text-[9px] font-bold bg-white text-primary px-2 py-0.5 rounded shadow-sm" onClick={async () => { await supabase.from('team_messages').update({ content: editText }).eq('id', msg.id); setEditingMessage(null); queryClient.invalidateQueries({ queryKey: ['team_messages'] }); }}>Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {msg.type === 'text' && <p className="text-[13px] leading-snug font-medium">{msg.content}</p>}
                            {msg.type === 'image' && <img src={msg.file_url} className="rounded-lg max-h-64 cursor-pointer shadow-sm border-2 border-white" onClick={() => window.open(msg.file_url)} />}
                            {msg.type === 'file' && <a href={msg.file_url} target="_blank" className={`flex items-center gap-2 p-1.5 rounded-lg bg-black/5 text-[12px] font-medium no-underline ${isMe ? 'text-white' : 'text-primary'}`}><FileText className="h-4 w-4"/>{msg.content}</a>}
                          </>
                        )}
                        <div className={`text-[7px] mt-0.5 font-bold opacity-40 text-right uppercase tracking-tighter ${isMe ? 'text-white' : 'text-slate-400'}`}>{format(new Date(msg.created_at), 'h:mm a')}</div>
                      </div>

                      {/* Actions Bar */}
                      <div className={`absolute top-0 ${isMe ? '-left-10' : '-right-10'} hidden group-hover:flex items-center gap-1 bg-white/80 backdrop-blur rounded-full p-1 border shadow-sm`}>
                        <button className="p-1 text-slate-400 hover:text-primary" onClick={() => setReplyTo(msg)}><Reply className="h-3 w-3"/></button>
                        {isMe && (
                          <>
                            <button className="p-1 text-slate-400 hover:text-amber-500" onClick={() => { setEditingMessage(msg.id); setEditText(msg.content); }}><Pencil className="h-3 w-3"/></button>
                            <button className="p-1 text-slate-400 hover:text-red-500" onClick={async () => { await supabase.from('team_messages').delete().eq('id', msg.id); queryClient.invalidateQueries({ queryKey: ['team_messages'] }); }}><Trash2 className="h-3 w-3"/></button>
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

          {/* Input Bar - Shifted Left & Glassy */}
          <div className="p-6 bg-white border-t border-slate-50">
            <div className="max-w-4xl mx-auto">
              {replyTo && (
                <div className="mb-2 p-2 bg-slate-50 border-l-2 border-primary text-[10px] flex justify-between items-center rounded-lg">
                  <span className="text-slate-500 italic truncate">Replying: {replyTo.content}</span>
                  <button onClick={() => setReplyTo(null)}><X className="h-3 w-3 text-slate-400"/></button>
                </div>
              )}
              {/* pr-12 moves the send button away from the far-right corner where your bot button lives */}
              <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 pl-4 pr-12 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:shadow-2xl transition-all">
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
                  
                  <Input className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-slate-800 placeholder:text-slate-400 font-bold text-sm h-10" placeholder="Message..." value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}/>
                  
                  <Button onClick={handleSend} className="rounded-xl h-8 w-8 bg-primary shadow-lg shadow-primary/20 hover:scale-[1.05] transition-transform p-0" disabled={!messageText.trim()}>
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