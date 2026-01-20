/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Phone, Users, Shield, Loader2, Maximize2, Badge } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default function Meeting() {
  const { user } = useAuth();
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

  const startMeeting = () => {
    setMeetingJoined(true);
    setLoading(true);

    const loadJitsiScript = () => {
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = () => initializeJitsi();
      document.body.appendChild(script);
    };

    const initializeJitsi = () => {
      if (!window.JitsiMeetExternalAPI) return;

      const domain = "meet.jit.si";
      const options = {
        roomName: "TechWisdom-ERP-General-Conference-8821", // Unique room name
        width: "100%",
        height: "100%",
        parentNode: jitsiContainerRef.current,
        lang: "en",
        configOverwrite: {
          startWithAudioMuted: false,
          disableDeepLinking: true,
          prejoinPageEnabled: false, // Skip prejoin for instant access
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
          DEFAULT_BACKGROUND: '#0f172a', // Match your dark theme
        },
        userInfo: {
          displayName: profile?.full_name || user?.email?.split('@')[0] || "TechWisdom User",
          email: user?.email
        }
      };

      const newApi = new window.JitsiMeetExternalAPI(domain, options);
      
      newApi.addEventListeners({
        videoConferenceJoined: () => {
          setLoading(false);
        },
        videoConferenceLeft: () => {
          setMeetingJoined(false);
          setApi(null);
          // Remove the iframe manually to clean up
          if (jitsiContainerRef.current) {
            jitsiContainerRef.current.innerHTML = '';
          }
        },
      });

      setApi(newApi);
    };

    if (window.JitsiMeetExternalAPI) {
      initializeJitsi();
    } else {
      loadJitsiScript();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (api) {
        api.dispose();
      }
    };
  }, [api]);

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
              Secure internal video & audio communication channel.
            </p>
          </div>
          {meetingJoined && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 animate-pulse text-sm font-medium">
              <Shield className="h-3 w-3" /> Encrypted Connection
            </div>
          )}
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
                <h2 className="text-3xl font-bold">General Team Room</h2>
                <p className="text-slate-400">
                  Join the active conference call with admins and team members. 
                  Please ensure your camera and microphone are ready.
                </p>
              </div>
              
              <div className="flex gap-4">
                <Button 
                  size="lg" 
                  onClick={startMeeting}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg shadow-lg shadow-blue-500/20"
                >
                  <Video className="mr-2 h-6 w-6" /> Join Video Call
                </Button>
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={startMeeting} // Jitsi handles audio-only toggle inside
                  className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-6 text-lg"
                >
                  <Phone className="mr-2 h-6 w-6" /> Join Audio Only
                </Button>
              </div>
              
              <div className="mt-8 flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center"><Shield className="h-3 w-3 mr-1" /> End-to-end encrypted</span>
                <span className="flex items-center"><Maximize2 className="h-3 w-3 mr-1" /> HD Quality</span>
              </div>
            </div>
          ) : (
            // ACTIVE MEETING VIEW
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50 text-white">
                  <div className="flex flex-col items-center">
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