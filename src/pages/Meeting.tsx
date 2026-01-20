/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Phone, Users, Shield, Loader2, Maximize2, PhoneOff, Lock, Badge } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default function Meeting() {
  const { user, role } = useAuth(); // Get user role
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

  // Function to handle ending the call manually
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

    const timeout = setTimeout(() => {
        setLoading(false);
    }, 3000); // Faster fallback

    const loadJitsiScript = () => {
      if (window.JitsiMeetExternalAPI) {
        initializeJitsi(type);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = () => initializeJitsi(type);
      document.body.appendChild(script);
    };

    const initializeJitsi = (callType: 'audio' | 'video') => {
      if (!window.JitsiMeetExternalAPI || !jitsiContainerRef.current) return;

      jitsiContainerRef.current.innerHTML = "";

      // 1. UNIQUE ROOM NAME
      // We append a fixed suffix to ensure it's unique to your company, 
      // avoiding "Waiting for moderator" issues from public room conflicts.
      const roomName = "TechWisdom-Internal-Sync-Room-V1"; 

      const domain = "meet.jit.si";
      const options = {
        roomName: roomName,
        width: "100%",
        height: "100%",
        parentNode: jitsiContainerRef.current,
        lang: "en",
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: callType === 'audio',
          disableDeepLinking: true, 
          prejoinPageEnabled: false, // SKIP PRE-JOIN SCREEN
          enableLobbyChat: false,
          enableClosePage: false, // Don't show "You left the meeting" page
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'security'
          ],
          APP_NAME: 'TechWisdom ERP',
          NATIVE_APP_NAME: 'TechWisdom ERP',
          DEFAULT_BACKGROUND: '#0f172a',
          // Hiding elements that might confuse users
          HIDE_INVITE_MORE_HEADER: true,
        },
        userInfo: {
          displayName: profile?.full_name || user?.email?.split('@')[0] || "Team Member",
          email: user?.email
        }
      };

      const newApi = new window.JitsiMeetExternalAPI(domain, options);
      
      newApi.addEventListeners({
        videoConferenceJoined: () => {
          clearTimeout(timeout);
          setLoading(false);
          // Force set display name again to be sure
          newApi.executeCommand('displayName', profile?.full_name || "Team Member");
        },
        videoConferenceLeft: () => {
          handleHangup();
        },
        // If the room requires a password (it shouldn't), this handles it gracefully
        passwordRequired: () => {
            setLoading(false); 
        }
      });

      setApi(newApi);
    };

    loadJitsiScript();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (api) {
        api.dispose();
      }
    };
  }, [api]);

  // --- ACCESS CONTROL: Only Admin & Employee ---
  if (role !== 'admin' && role !== 'employee') {
    return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <div className="p-4 bg-red-100 rounded-full">
                    <Lock className="h-10 w-10 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Access Restricted</h1>
                <p className="text-muted-foreground max-w-md">
                    This conference line is reserved for internal team communication (Admins & Employees) only.
                </p>
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
              <Video className="h-6 w-6 text-primary" /> TechWisdom Conference
            </h1>
            <p className="text-muted-foreground text-sm">
              Internal Team Bridge • {role === 'admin' ? 'Administrator' : 'Employee'} Access
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {meetingJoined && (
                <>
                    <Badge  className="bg-green-50 text-green-700 border-green-200 animate-pulse hidden sm:flex">
                    <Shield className="h-3 w-3 mr-1" /> Encrypted
                    </Badge>
                    
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={handleHangup}
                        className="shadow-md"
                    >
                        <PhoneOff className="h-4 w-4 mr-2" /> End Call
                    </Button>
                </>
            )}
          </div>
        </div>

        {/* MEETING CONTAINER */}
        <Card className="flex-1 overflow-hidden border-2 bg-slate-900 relative shadow-2xl">
          
          {!meetingJoined ? (
            // LOBBY VIEW
            <div className="h-full flex flex-col items-center justify-center space-y-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 text-center">
              <div className="bg-white/10 p-6 rounded-full ring-4 ring-white/5">
                <Users className="h-16 w-16 text-blue-400" />
              </div>
              <div className="max-w-md space-y-2">
                <h2 className="text-3xl font-bold">Team Sync Room</h2>
                <p className="text-slate-400">
                  Ready to join? Select your preferred mode below.
                  <br/>
                  <span className="text-xs text-slate-500">(First person to join becomes the Host automatically)</span>
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button 
                  size="lg" 
                  onClick={() => startMeeting('video')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg shadow-lg shadow-blue-500/20 w-full sm:w-auto"
                >
                  <Video className="mr-2 h-6 w-6" /> Join with Video
                </Button>
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={() => startMeeting('audio')}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-6 text-lg w-full sm:w-auto"
                >
                  <Phone className="mr-2 h-6 w-6" /> Audio Only
                </Button>
              </div>
              
              <div className="mt-8 flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center"><Shield className="h-3 w-3 mr-1" /> Secure</span>
                <span className="flex items-center"><Maximize2 className="h-3 w-3 mr-1" /> Low Latency</span>
              </div>
            </div>
          ) : (
            // ACTIVE MEETING VIEW
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50 text-white pointer-events-none">
                  <div className="flex flex-col items-center bg-slate-800/80 p-6 rounded-xl backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
                    <p>Connecting to secure server...</p>
                  </div>
                </div>
              )}
              {/* Jitsi Iframe Target */}
              <div ref={jitsiContainerRef} className="w-full h-full" />
            </>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}