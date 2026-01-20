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
  Reply, X, FileText, Loader2 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CLOUDINARY_CLOUD_NAME = "dljiukpd4"; 
const CLOUDINARY_PRESET = "chat_upload"; 
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
const QUICK_EMOJIS = ["😀", "😂", "❤️", "👍", "🙌", "🔥"];

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
  
  // 1. Fetch Users - Added enabled check to fix "undefined" error
  const { data: users = [] } = useQuery({
    queryKey: ['chat_users', user?.id],
    enabled: !!user?.id, 
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').neq('id', user?.id);
      return data || [];
    }
  });

  // 2. Fetch Messages from 'team_messages'
  const { data: messages = [], isError, isLoading } = useQuery({
    queryKey: ['team_messages', activeChat?.id || 'general', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from('team_messages')
        .select(`
          *,
          sender:profiles!team_messages_sender_id_fkey (full_name, avatar_url)
        `)
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

  // 3. Realtime Listener
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('team_chat_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['team_messages'] });
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeChat, queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Send Logic
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, type = 'text', fileUrl = null }: any) => {
      await (supabase.from('team_messages') as any).insert({
        sender_id: user?.id,
        receiver_id: activeChat?.id || null, 
        content,
        type,
        file_url: fileUrl,
        reply_to: replyTo?.id || null
      });
    }
  });

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendMessageMutation.mutate({ content: messageText });
    setMessageText('');
    setReplyTo(null);
    setShowEmoji(false);
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
        toast.error("Cloud upload failed");
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
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Team Channels</h3>
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
              <div>
                <h2 className="font-bold">{activeChat ? activeChat.full_name : 'Team General'}</h2>
                <p className="text-[10px] text-green-500 font-medium uppercase tracking-tighter">Live Sync Enabled</p>
              </div>
            </div>
            <div className="flex gap-1">
               <Button variant="ghost" size="icon" onClick={() => navigate('/meeting')}><Phone className="h-5 w-5"/></Button>
               <Button variant="ghost" size="icon" onClick={() => navigate('/meeting')}><Video className="h-5 w-5"/></Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4 bg-slate-50/30">
            {isLoading && <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" /></div>}
            <div className="space-y-4">
              {messages.map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl max-w-[75%] shadow-sm relative group ${msg.sender_id === user?.id ? 'bg-primary text-white rounded-tr-none' : 'bg-white border rounded-tl-none'}`}>
                    {!activeChat && msg.sender_id !== user?.id && <div className="text-[10px] font-bold mb-1 text-primary">{msg.sender?.full_name}</div>}
                    {msg.type === 'text' && <p className="text-sm leading-relaxed">{msg.content}</p>}
                    {msg.type === 'image' && <img src={msg.file_url} className="rounded-lg max-h-60" onClick={() => window.open(msg.file_url)} />}
                    {msg.type === 'file' && <a href={msg.file_url} target="_blank" className="flex items-center gap-2 text-xs underline"><FileText className="h-4 w-4"/>{msg.content}</a>}
                    <div className="text-[9px] mt-1 opacity-70 text-right">{format(new Date(msg.created_at), 'h:mm a')}</div>
                    <button className="absolute -right-8 top-2 hidden group-hover:block transition-all" onClick={() => setReplyTo(msg)}><Reply className="h-4 w-4 text-slate-400"/></button>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* INPUT */}
          <div className="p-4 bg-white border-t relative">
            {replyTo && <div className="p-2 mb-2 bg-slate-50 rounded text-xs flex justify-between border-l-4 border-primary"><span>Replying...</span><button onClick={() => setReplyTo(null)}><X className="h-4 w-4"/></button></div>}
            {showEmoji && (
                <div className="absolute bottom-20 left-4 bg-white border rounded-full p-2 shadow-xl flex gap-2 animate-in slide-in-from-bottom-2 z-50">
                    {QUICK_EMOJIS.map(e => (
                        <button key={e} onClick={() => {setMessageText(prev => prev + e); setShowEmoji(false);}} className="hover:scale-125 transition-transform p-1 text-lg">{e}</button>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setShowEmoji(!showEmoji)}><Smile className="h-5 w-5"/></Button>
                <div className="relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading}/>
                    <Button variant="ghost" size="icon">{isUploading ? <Loader2 className="animate-spin h-5 w-5"/> : <Paperclip className="h-5 w-5"/>}</Button>
                </div>
                <Input className="flex-1 bg-slate-100 border-0 focus-visible:ring-0" placeholder="Message Team..." value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}/>
                <Button onClick={handleSend} disabled={!messageText.trim() && !isUploading} className="rounded-full"><Send className="h-4 w-4"/></Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}