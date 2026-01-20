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
  Send, Paperclip, Smile, Search, MoreVertical, Phone, Video, 
  Reply, X, FileText, Loader2, Trash2, Pencil, Check, Volume2, VolumeX
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CLOUDINARY_CLOUD_NAME = "dljiukpd4"; 
const CLOUDINARY_PRESET = "chat_upload"; 
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

// Sound link - High quality notification
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
const QUICK_EMOJIS = ["😀", "😂", "❤️", "👍", "🙌", "🔥"];

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // States
  const [activeChat, setActiveChat] = useState<any>(null); 
  const [messageText, setMessageText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Edit State
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editText, setEditText] = useState('');

  // 1. Fetch Users
  const { data: users = [] } = useQuery({
    queryKey: ['chat_users', user?.id],
    enabled: !!user?.id, 
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').neq('id', user?.id);
      return data || [];
    }
  });

  // 2. Fetch Messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['team_messages', activeChat?.id || 'general', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from('team_messages')
        .select(`*, sender:profiles!team_messages_sender_id_fkey (full_name, avatar_url)`)
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

  // 3. Realtime + Multi-Sensory Notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('team_chat_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_messages' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['team_messages'] });

        if (payload.eventType === 'INSERT' && payload.new.sender_id !== user?.id) {
          // Play Sound
          if (!isMuted) {
            const audio = new Audio(NOTIFICATION_SOUND);
            audio.play().catch(e => console.log("Audio play blocked by browser:", e));
          }

          // Visual Toast
          toast("New Team Message", {
            description: payload.new.content?.substring(0, 40) || "Shared a file",
          });

          // Browser Notification
          if (Notification.permission === "granted") {
            new Notification("TechWisdom ERP", { body: "New message in chat" });
          }
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeChat, queryClient, isMuted]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Request Notifications on first load
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
  }, []);

  // 4. Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, type = 'text', fileUrl = null }: any) => {
      await supabase.from('team_messages').insert({
        sender_id: user?.id,
        receiver_id: activeChat?.id || null, 
        content, type, file_url: fileUrl,
        reply_to: replyTo?.id || null
      });
    }
  });

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from('team_messages').delete().eq('id', id);
    if (error) toast.error("Delete failed");
    else queryClient.invalidateQueries({ queryKey: ['team_messages'] });
  };

  const saveEdit = async () => {
    if (!editText.trim()) return;
    const { error } = await supabase.from('team_messages').update({ content: editText }).eq('id', editingMessage);
    if (error) toast.error("Edit failed");
    else {
        setEditingMessage(null);
        queryClient.invalidateQueries({ queryKey: ['team_messages'] });
    }
  };

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendMessageMutation.mutate({ content: messageText });
    setMessageText('');
    setReplyTo(null);
  };

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);
    try {
        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await res.json();
        if (data.secure_url) {
            const type = file.type.startsWith('image/') ? 'image' : 'file';
            sendMessageMutation.mutate({ content: file.name, type, fileUrl: data.secure_url });
        }
    } catch (err) {
        toast.error("Upload error");
    } finally {
        setIsUploading(false);
    }
  };

  if (!user) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-140px)] gap-4 animate-fade-in">
        {/* SIDEBAR */}
        <Card className="w-80 flex flex-col border-r glass-card hidden md:flex overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Channels</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMuted(!isMuted)}>
                    {isMuted ? <VolumeX className="h-4 w-4 text-red-500" /> : <Volume2 className="h-4 w-4 text-green-500" />}
                </Button>
            </div>
            <button onClick={() => setActiveChat(null)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${!activeChat ? 'bg-primary text-white shadow-md' : 'hover:bg-slate-100'}`}>
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold">#</div>
              <div className="text-left font-semibold">General Feed</div>
            </button>
          </div>
          <ScrollArea className="flex-1 p-2">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Direct Messages</div>
            {users.filter((u: any) => u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())).map((u: any) => (
              <button key={u.id} onClick={() => setActiveChat(u)} className={`w-full flex items-center gap-3 p-3 rounded-xl mt-1 transition-all ${activeChat?.id === u.id ? 'bg-primary text-white' : 'hover:bg-slate-100'}`}>
                <Avatar className="h-10 w-10 border-2 border-white"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.full_name?.charAt(0)}</AvatarFallback></Avatar>
                <div className="text-left font-medium truncate">{u.full_name}</div>
              </button>
            ))}
          </ScrollArea>
        </Card>

        {/* CHAT WINDOW */}
        <Card className="flex-1 flex flex-col shadow-lg border-0 glass-card overflow-hidden">
          <div className="p-4 border-b bg-white/50 backdrop-blur-md flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Avatar className="ring-2 ring-primary/20"><AvatarImage src={activeChat?.avatar_url} /><AvatarFallback>#</AvatarFallback></Avatar>
              <h2 className="font-bold">{activeChat ? activeChat.full_name : 'Team General'}</h2>
            </div>
            <div className="flex gap-1">
               <Button variant="ghost" size="icon" onClick={() => navigate('/meeting')}><Phone className="h-5 w-5"/></Button>
               <Button variant="ghost" size="icon" onClick={() => navigate('/meeting')}><Video className="h-5 w-5"/></Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4 bg-slate-50/30">
            <div className="space-y-4">
              {messages.map((msg: any) => {
                const isMe = msg.sender_id === user?.id;
                const isEditing = editingMessage === msg.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col group relative`}>
                      {!isMe && !activeChat && <div className="text-[10px] font-bold mb-1 text-primary">{msg.sender?.full_name}</div>}
                      
                      <div className={`p-3 rounded-2xl shadow-sm ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white border rounded-tl-none'}`}>
                        {isEditing ? (
                            <div className="flex flex-col gap-2">
                                <Input className="text-black bg-white h-8" value={editText} onChange={e => setEditText(e.target.value)} />
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="ghost" className="h-6 text-white" onClick={() => setEditingMessage(null)}>Cancel</Button>
                                  <Button size="sm" className="h-6 bg-white text-primary" onClick={saveEdit}>Save</Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {msg.type === 'text' && <p className="text-sm">{msg.content}</p>}
                                {msg.type === 'image' && <img src={msg.file_url} className="rounded-lg max-h-60" />}
                                {msg.type === 'file' && <a href={msg.file_url} target="_blank" className="flex items-center gap-2 text-xs underline"><FileText className="h-4 w-4"/>{msg.content}</a>}
                            </>
                        )}
                        <div className="text-[9px] mt-1 opacity-70 text-right">{format(new Date(msg.created_at), 'h:mm a')}</div>
                      </div>

                      {/* ACTIONS MENU - VISIBLE ON HOVER */}
                      <div className={`absolute -top-4 ${isMe ? 'left-0' : 'right-0'} hidden group-hover:flex items-center gap-1 bg-white border rounded-full px-2 py-1 shadow-md z-10`}>
                          <button className="p-1 hover:text-blue-500 transition-colors" onClick={() => setReplyTo(msg)}><Reply className="h-3 w-3"/></button>
                          {isMe && (
                              <>
                                <button className="p-1 hover:text-amber-500 transition-colors" onClick={() => { setEditingMessage(msg.id); setEditText(msg.content); }}><Pencil className="h-3 w-3"/></button>
                                <button className="p-1 hover:text-red-500 transition-colors" onClick={() => deleteMessage(msg.id)}><Trash2 className="h-3 w-3"/></button>
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

          <div className="p-4 bg-white border-t relative">
            {replyTo && <div className="p-2 mb-2 bg-slate-50 rounded text-xs flex justify-between border-l-4 border-primary"><span>Replying to: {replyTo.content?.substring(0, 30)}</span><button onClick={() => setReplyTo(null)}><X className="h-4 w-4"/></button></div>}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setShowEmoji(!showEmoji)}><Smile className="h-5 w-5"/></Button>
                <div className="relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading}/>
                    <Button variant="ghost" size="icon">{isUploading ? <Loader2 className="animate-spin h-5 w-5"/> : <Paperclip className="h-5 w-5"/>}</Button>
                </div>
                <Input className="flex-1 bg-slate-100 border-0" placeholder="Message Team..." value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}/>
                <Button onClick={handleSend} className="rounded-full h-10 w-10" disabled={!messageText.trim()}><Send className="h-5 w-5"/></Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}