/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bot, X, Send, Loader2, Wifi, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Define the 3 possible states clearly
type ConnectionStatus = 'online' | 'offline' | 'error';

export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Default to online if browser has internet
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    navigator.onLine ? 'online' : 'offline'
  );

  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Hello! I am connected to your database. Ask me: "How many leads do we have?"' }
  ]);

  // Monitor Browser Internet Connection
  useEffect(() => {
    const handleOnline = () => {
      // Only switch to online if we aren't in a "System Error" state
      setConnectionStatus(prev => prev === 'error' ? 'error' : 'online');
    };
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAsk = async () => {
    if (!query.trim()) return;
    
    // Prevent sending if we already know it's offline/error
    if (connectionStatus !== 'online') {
        toast.error("Cannot send message. Check connection.");
        return;
    }

    const userMsg = query;
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    setLoading(true);

    try {
      // 1. Send Request
      const { data, error } = await supabase.functions.invoke('chat-bot', {
        body: { query: userMsg }
      });

      // 2. Check for "Hard" Errors (Network/500 Crashes)
      if (error) {
        console.error("Supabase Invoke Error:", error);
        throw new Error(error.message || "Server Error");
      }

      // 3. Check for "Soft" Errors (Function returned { error: "..." })
      if (data?.error) {
        throw new Error(data.error);
      }

      // Success!
      setMessages((prev) => [...prev, { role: 'ai', text: data.answer || "I couldn't find an answer." }]);
      setConnectionStatus('online'); // Confirm we are good

    } catch (err: any) {
      console.error("Chat Error:", err);
      
      // *** FORCE ERROR STATE ***
      // This turns the dot RED immediately
      setConnectionStatus('error');
      
      setMessages((prev) => [...prev, { 
        role: 'ai', 
        text: "⚠️ System Error: I cannot connect to the database right now." 
      }]);
      
      toast.error("Connection Failed. Server might be down.");
    } finally {
      setLoading(false);
    }
  };

  const retryConnection = () => {
    setLoading(true);
    // Reset to "Online" check
    setTimeout(() => {
        setConnectionStatus(navigator.onLine ? 'online' : 'offline');
        setLoading(false);
        toast.success("Retrying connection...");
    }, 1000);
  };

  const getStatusColor = () => {
    if (connectionStatus === 'online') return 'bg-green-500';
    if (connectionStatus === 'offline') return 'bg-gray-400';
    return 'bg-red-500'; // System Error is RED
  };

  const getStatusText = () => {
    if (connectionStatus === 'online') return 'AI Online';
    if (connectionStatus === 'offline') return 'No Internet';
    return 'System Error'; // Explicit text
  };

  return (
    <>
      {/* Floating Button - Docked to Corner */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          // CHANGED: Position (bottom-0 right-0), Shape (rounded-tl-xl only), Size (h-12 w-12)
          className={`fixed bottom-0 right-0 h-12 w-12 rounded-tl-xl rounded-tr-none rounded-bl-none rounded-br-none shadow-lg z-50 transition-transform hover:scale-105 ${
            connectionStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {/* CHANGED: Icons made slightly smaller (h-6 w-6) to fit new size */}
          {connectionStatus === 'error' ? <AlertTriangle className="h-5 w-5 text-white" /> : <Bot className="h-6 w-6 text-white" />}
          
          {/* Status Dot - Adjusted position to be inside the square */}
          <span className={`absolute top-2 right-2 h-3 w-3 rounded-full border-2 border-white ${getStatusColor()}`} />
        </Button>
      )}

      {/* Chat Window - Docked to Corner */}
      {isOpen && (
        // CHANGED: Position (bottom-0 right-0), Height/Width (smaller), Border Radius (rounded-tl-xl)
        <Card className="fixed bottom-0 right-0 w-80 h-[450px] shadow-2xl z-50 flex flex-col border-blue-500/20 animate-in slide-in-from-bottom-10 fade-in duration-300 rounded-tl-xl rounded-tr-none rounded-bl-none rounded-br-none border-r-0 border-b-0">
          <CardHeader className="bg-blue-50/50 border-b p-3 flex flex-row items-center justify-between space-y-0">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Bot className={`h-5 w-5 ${connectionStatus === 'error' ? 'text-red-600' : 'text-blue-600'}`} />
                <CardTitle className="text-sm">TechWisdom AI</CardTitle>
              </div>
              
              {/* Status Text */}
              <div className="flex items-center gap-1.5 px-1">
                <span className={`h-2 w-2 rounded-full ${getStatusColor()} ${connectionStatus === 'online' ? 'animate-pulse' : ''}`} />
                <span className={`text-[10px] font-medium ${
                  connectionStatus === 'error' ? 'text-red-600' : 
                  connectionStatus === 'offline' ? 'text-gray-500' : 'text-green-600'
                }`}>
                  {getStatusText()}
                </span>
              </div>
            </div>

            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            
            {/* Error Banner (Shows when 500 Error happens) */}
            {connectionStatus === 'error' && (
               <div className="flex justify-center my-2 animate-in fade-in zoom-in">
                 <Button 
                   variant="destructive" 
                   size="sm" 
                   className="text-[10px] h-7 gap-2 rounded-full shadow-sm"
                   onClick={retryConnection}
                 >
                   <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                   Retry Connection
                 </Button>
               </div>
            )}

            {/* Offline Banner */}
            {connectionStatus === 'offline' && (
               <div className="flex justify-center my-2">
                 <div className="bg-gray-100 text-gray-600 text-[10px] px-3 py-1 rounded-full flex items-center gap-2">
                   <WifiOff className="h-3 w-3" />
                   You are offline
                 </div>
               </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[90%] p-2.5 rounded-lg text-xs ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-muted text-foreground rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted p-2.5 rounded-lg rounded-bl-none">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="p-2 border-t">
            <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="flex w-full gap-2">
              <Input 
                placeholder={connectionStatus === 'online' ? "Ask AI..." : "No connection"}
                value={query} 
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 h-9 text-sm"
                disabled={connectionStatus !== 'online' || loading}
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={connectionStatus !== 'online' || loading} 
                className={`h-9 w-9 ${connectionStatus !== 'online' ? 'bg-gray-300' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {connectionStatus === 'online' ? <Send className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
}