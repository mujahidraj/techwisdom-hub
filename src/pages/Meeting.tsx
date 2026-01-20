/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Phone, Users, Shield, Loader2, Maximize2, PhoneOff, Lock, Mic } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default function Meeting() {
  const { user, role } = useAuth();
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [meetingJoined, setMeetingJoined] = useState(false);
  const [api, setApi] = useState<any>(null);

  // Fetch user profile for display name
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      return data;
    }
  });

  const handleHangup = () => {
    if (api) {
        api.dispose();
    }
    setApi(null);
    setMeetingJoined(false);
    setLoading(true);
  };

  const startMeeting = (type: 'audio' | 'video') => {
    setMeetingJoined(true);
    setLoading(true);

    // Fallback: Force remove loading screen after 3s to ensure UI access
    const timeout = setTimeout(() => {
        setLoading(false);
    }, 3000);

    const loadJitsiScript = () => {
      // Cleanup previous scripts
      const existingScript = document.getElementById('jitsi-external-api');
      if (existingScript) existingScript.remove();

      // Load official script
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js"; 
      script.async = true;
      script.id = 'jitsi-external-api';
      script.onload = () => initializeJitsi(type);
      document.body.appendChild(script);
    };

    const initializeJitsi = (callType: 'audio' | 'video') => {
      if (!window.JitsiMeetExternalAPI || !jitsiContainerRef.current) return;

      jitsiContainerRef.current.innerHTML = "";

      // Server: Community hosted (allows anonymous rooms)
      const domain = "meet.guifi.net"; 
      
      // Unique Room Name
      const roomName = "TechWisdom-Technologies-Global-Sync-9988"; 

      const options = {
        roomName: roomName,
        width: "100%",
        height: "100%",
        parentNode: jitsiContainerRef.current,
        lang: "en",
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: callType === 'audio',
          prejoinPageEnabled: false, 
          requireDisplayName: false,
          disableDeepLinking: true,
          enableLobbyChat: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#0f172a',
          APP_NAME: 'TechWisdom Technologies',
          NATIVE_APP_NAME: 'TechWisdom Technologies',
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'chat', 
            'raisehand', 'videoquality', 'tileview', 'mute-everyone'
          ],
        },
        userInfo: {
          displayName: profile?.full_name || "Team Member",
          email: user?.email
        }
      };

      const newApi = new window.JitsiMeetExternalAPI(domain, options);
      
      newApi.addEventListeners({
        videoConferenceJoined: () => {
          clearTimeout(timeout);
          setLoading(false);
          newApi.executeCommand('displayName', profile?.full_name || "Team Member");
          
          if (callType === 'audio') {
             newApi.executeCommand('videoMute');
          }
        },
        videoConferenceLeft: () => {
          handleHangup();
        },
      });

      setApi(newApi);
    };

    loadJitsiScript();
  };

  useEffect(() => {
    return () => {
      if (api) api.dispose();
    };
  }, [api]);

  // Access Control: Admins & Employees Only
  if (role !== 'admin' && role !== 'employee') {
    return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <div className="p-4 bg-red-100 rounded-full">
                    <Lock className="h-10 w-10 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Restricted Channel</h1>
                <Button onClick={() => window.history.back()}>Go Back</Button>
            </div>
        </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-100px)] space-y-4 animate-fade-in">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mic className="h-6 w-6 text-primary" /> TechWisdom General
            </h1>
            <p className="text-muted-foreground text-sm">
              Open Team Channel • No Moderator Needed
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {meetingJoined && (
                <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleHangup}
                    className="shadow-md animate-in fade-in"
                >
                    <PhoneOff className="h-4 w-4 mr-2" /> Disconnect
                </Button>
            )}
          </div>
        </div>

        {/* MEETING CONTAINER */}
        <Card className="flex-1 overflow-hidden border-2 bg-slate-900 relative shadow-2xl flex flex-col">
          
          {!meetingJoined ? (
            // LOBBY VIEW
            <div className="h-full flex flex-col items-center justify-center space-y-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 text-center">
              
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 rounded-full"></div>
                <div className="bg-white/10 p-8 rounded-full ring-1 ring-white/10 relative z-10">
                  <Users className="h-20 w-20 text-blue-400" />
                </div>
              </div>

              <div className="max-w-md space-y-2">
                <h2 className="text-3xl font-bold">TechWisdom Sync</h2>
                <p className="text-slate-400">
                  Click below to join immediately. <br/>
                  First person in creates the room automatically.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button 
                  size="lg" 
                  onClick={() => startMeeting('audio')}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg w-full sm:w-64 transition-all hover:scale-105"
                >
                  <Phone className="mr-2 h-6 w-6" /> Join Voice
                </Button>
                
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={() => startMeeting('video')}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-6 text-lg w-full sm:w-64 transition-all hover:scale-105"
                >
                  <Video className="mr-2 h-6 w-6" /> Join Video
                </Button>
              </div>
              
              <div className="mt-8 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center"><Shield className="h-3 w-3 mr-1" /> Secured by TechWisdom Technologies</span>
                <span className="flex items-center"><Maximize2 className="h-3 w-3 mr-1" /> HD Quality</span>
              </div>
            </div>
          ) : (
            // ACTIVE MEETING VIEW
            <div className="flex-1 relative bg-black">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50 text-white pointer-events-none">
                  <div className="flex flex-col items-center bg-slate-800/80 p-6 rounded-xl backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
                    <p>Connecting to secure channel...</p>
                  </div>
                </div>
              )}
              {/* Jitsi Iframe Target */}
              <div ref={jitsiContainerRef} className="w-full h-full" />
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}