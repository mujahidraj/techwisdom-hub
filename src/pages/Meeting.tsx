/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Video, Phone, Shield, Lock, Mic, Users, AlertCircle, VideoOff, MicOff, Maximize2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Meeting() {
  const { user, role } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [meetingJoined, setMeetingJoined] = useState(!!window.__activeMeeting?.joined);

  // Live Device Previews state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sync with global meeting state
  useEffect(() => {
    const handleStateChange = () => {
      setMeetingJoined(!!window.__activeMeeting?.joined);
    };
    window.addEventListener('meetingStateChange', handleStateChange);
    return () => window.removeEventListener('meetingStateChange', handleStateChange);
  }, []);

  // Fetch user profile for display name
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      return data;
    }
  });

  // Track Webcam and Microphone streams for Live Preview in the Lobby
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (!meetingJoined) {
      async function setupDevices() {
        try {
          // Request both video and audio
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: true
          });

          setLocalStream(activeStream);
          setCameraActive(true);
          setVideoError(null);
          setAudioError(null);

          // Render live camera stream to video element
          if (videoRef.current) {
            videoRef.current.srcObject = activeStream;
          }

          // Setup AudioContext for microphone level detection
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioContext = new AudioContextClass();
            const source = audioContext.createMediaStreamSource(activeStream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVolume = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
              }
              const average = sum / bufferLength;
              setMicLevel(Math.min(100, Math.round((average / 128) * 100)));
              animationFrameRef.current = requestAnimationFrame(updateVolume);
            };

            updateVolume();
          }
        } catch (err: any) {
          console.warn("Could not acquire dual camera/mic stream, trying audio only fallback...", err);
          setVideoError("Camera input not allowed or busy.");
          setCameraActive(false);

          // Fallback to audio only
          try {
            activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(activeStream);
            setAudioError(null);

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              const audioContext = new AudioContextClass();
              const source = audioContext.createMediaStreamSource(activeStream);
              const analyser = audioContext.createAnalyser();
              analyser.fftSize = 256;
              source.connect(analyser);

              audioContextRef.current = audioContext;
              analyserRef.current = analyser;

              const bufferLength = analyser.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);

              const updateVolume = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                  sum += dataArray[i];
                }
                const average = sum / bufferLength;
                setMicLevel(Math.min(100, Math.round((average / 128) * 100)));
                animationFrameRef.current = requestAnimationFrame(updateVolume);
              };

              updateVolume();
            }
          } catch (audioErr) {
            console.error("Microphone access completely rejected:", audioErr);
            setAudioError("Microphone input blocked or not found.");
            setMicLevel(0);
          }
        }
      }

      setupDevices();
    }

    return () => {
      // Clean up local media streams & contexts on hangup/unmount
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      setLocalStream(null);
      setCameraActive(false);
      setMicLevel(0);
    };
  }, [meetingJoined]);

  // Toggle Previews on the Left Panel
  const toggleCameraPreview = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraActive(videoTrack.enabled);
      } else {
        // Try to re-acquire video track
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
          const newTrack = stream.getVideoTracks()[0];
          localStream.addTrack(newTrack);
          if (videoRef.current) videoRef.current.srcObject = localStream;
          setCameraActive(true);
          setVideoError(null);
        }).catch(() => {
          setVideoError("Camera input blocked or not found.");
        });
      }
    }
  };

  const toggleMicPreview = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioError(audioTrack.enabled ? null : "Muted");
        if (!audioTrack.enabled) {
          setMicLevel(0);
        }
      }
    }
  };

  const startMeeting = (type: 'audio' | 'video') => {
    // Stop local preview tracks so that Jitsi can claim the devices clean
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }

    if (window.startGlobalMeeting) {
      window.startGlobalMeeting(type);
    }
  };

  // Access Control
  if (role !== 'admin' && role !== 'employee') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6 max-w-md mx-auto animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full scale-125 animate-pulse" />
            <div className="bg-[#C00707]/10 p-6 rounded-full border border-[#C00707]/20 relative z-10">
              <Lock className="h-12 w-12 text-[#C00707]" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Restricted Channel</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This video conference stream is restricted to TechWisdom administrative and staff personnel only.
            </p>
          </div>
          <Button onClick={() => window.history.back()} className="rounded-xl px-6 font-bold shadow-md hover:scale-105 active:scale-95 transition-all">
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="absolute inset-0 bg-[#090d16] text-white overflow-hidden flex flex-col animate-fade-in">
        
        {!meetingJoined ? (
          // SPLIT-SCREEN LOBBY VIEW (TechWisdom Fire Theme - Full Screen with Live Media Devices)
          <div className="flex-1 w-full flex flex-col lg:flex-row relative">
            
            {/* Backglows */}
            <div className="absolute top-0 right-0 h-[350px] w-[350px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 h-[350px] w-[350px] bg-orange-600/5 rounded-full blur-[100px] pointer-events-none" />
 
            {/* LEFT SIDE: Real Device Monitor & Stage Preview */}
            <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-white/5 bg-[#030712]/45 backdrop-blur-sm z-10">
              <div className="max-w-md mx-auto w-full space-y-6">
                
                {/* Genuine Stage Feed Preview */}
                <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900 shadow-2xl flex items-center justify-center w-full">
                  
                  {/* Live Local Webcam Stream */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${cameraActive ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`}
                  />

                  {/* Standby Placeholder */}
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-[#030712] text-slate-400">
                      <div className="p-4 bg-white/5 rounded-full border border-white/10 relative">
                        <div className="absolute inset-0 bg-red-500/10 blur-md rounded-full scale-125 animate-pulse" />
                        <VideoOff className="h-8 w-8 text-orange-500 relative z-10" />
                      </div>
                      <span className="text-[10px] font-black tracking-widest uppercase text-orange-400/80">Camera Feed Off</span>
                      <p className="text-[9px] text-slate-500 max-w-[220px] text-center mt-1">
                        {videoError || "Camera signal is currently deactivated."}
                      </p>
                    </div>
                  )}

                  {/* Left status badge */}
                  <div className="absolute bottom-4 left-6 z-20 flex items-center gap-2 bg-[#090d16]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-md">
                    <div className={`h-2 w-2 rounded-full ${cameraActive ? 'bg-emerald-500 animate-ping' : 'bg-red-500 animate-pulse'}`} />
                    <span className="text-[9px] font-bold tracking-widest uppercase text-slate-300">
                      {cameraActive ? 'Stage Feed Live' : 'Stage Standby'}
                    </span>
                  </div>

                  {/* Reactive Audio Level Indicator */}
                  <div className="absolute bottom-4 right-6 z-20 flex items-center gap-2 bg-[#090d16]/95 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                    {audioError ? (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-[9px] font-black uppercase text-red-400/80">Muted</span>
                      </div>
                    ) : (
                      <>
                        <Mic className={`h-3.5 w-3.5 transition-all ${micLevel > 15 ? 'text-orange-500 scale-110 animate-bounce' : 'text-slate-400'}`} />
                        <div className="flex gap-0.5 items-end h-2.5 w-16">
                          <div className="w-1.5 bg-red-600 rounded-full transition-all duration-75" style={{ height: `${Math.max(15, micLevel * 0.8)}%` }} />
                          <div className="w-1.5 bg-orange-600 rounded-full transition-all duration-75" style={{ height: `${Math.max(15, micLevel * 1.0)}%` }} />
                          <div className="w-1.5 bg-amber-500 rounded-full transition-all duration-75" style={{ height: `${Math.max(15, micLevel * 0.9)}%` }} />
                          <div className="w-1.5 bg-emerald-500 rounded-full transition-all duration-75" style={{ height: `${Math.max(15, micLevel * 0.6)}%` }} />
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-300 w-6 text-right">{micLevel}%</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Device Configuration Dashboard */}
                <div className="bg-[#030712]/50 border border-white/5 p-5 rounded-2xl space-y-4 shadow-inner">
                  
                  {/* Glowing Toggle Buttons */}
                  <div className="flex gap-3">
                    <Button 
                      variant="ghost" 
                      onClick={toggleCameraPreview} 
                      className={`flex-1 py-5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 ${cameraActive ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                    >
                      {cameraActive ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                      {cameraActive ? 'Camera ON' : 'Camera OFF'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={toggleMicPreview} 
                      className={`flex-1 py-5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 ${!audioError ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                    >
                      {!audioError ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                      {!audioError ? 'Mic ON' : 'Mic OFF'}
                    </Button>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-orange-500" /> Active Stage Monitor
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs mt-2.5">
                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                        <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Input Source</p>
                        <p className="font-semibold text-slate-200 mt-1 truncate">
                          {audioError ? "Device Blocked" : "System Microphone"}
                        </p>
                      </div>
                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                        <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Output Node</p>
                        <p className="font-semibold text-slate-200 mt-1 truncate">Standard Speaker</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT SIDE: Action panel & Join Controls */}
            <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center bg-[#090d16]/60 backdrop-blur-md z-10">
              <div className="max-w-md mx-auto w-full space-y-8">
                
                {/* Branding Header */}
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#FF4400] bg-[#FF4400]/10 border border-[#FF4400]/20 px-3 py-1 rounded-full">
                    <Users className="h-3 w-3" /> TechWisdom Enterprise Room
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-none">
                    General Sync
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Connect instantly with colleagues over voice or video. First member to enter automatically spins up the room infrastructure.
                  </p>
                </div>

                {/* Selection Cards */}
                <div className="space-y-4">
                  
                  {/* Audio Option */}
                  <button
                    onClick={() => startMeeting('audio')}
                    className="w-full text-left p-6 bg-[#030712]/45 border border-white/5 hover:border-orange-500/30 rounded-2xl flex items-center justify-between group transition-all duration-300 hover:scale-[1.02]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#090d16] border border-white/10 rounded-xl group-hover:bg-orange-500/10 group-hover:border-orange-500/20 transition-all">
                        <Phone className="h-6 w-6 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-200 group-hover:text-white transition-colors">Join Voice Stream</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Mute camera automatically, stream audio only</p>
                      </div>
                    </div>
                    <div className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-orange-500 group-hover:border-orange-500/30 transition-all">
                      →
                    </div>
                  </button>

                  {/* Video Option */}
                  <button
                    onClick={() => startMeeting('video')}
                    className="w-full text-left p-6 bg-gradient-to-r from-red-955/20 via-orange-955/20 to-amber-955/20 border border-red-500/20 hover:border-red-500/40 rounded-2xl flex items-center justify-between group transition-all duration-300 hover:scale-[1.02]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 rounded-xl transition-all shadow-lg shadow-orange-955/30">
                        <Video className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-200 group-hover:text-white transition-colors">Join Full Video HD</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Stream high-definition webcam feed & screen</p>
                      </div>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 group-hover:bg-gradient-to-r group-hover:from-red-600 group-hover:to-orange-600 group-hover:border-transparent transition-all">
                      →
                    </div>
                  </button>

                </div>

                {/* Badges footer */}
                <div className="pt-6 border-t border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-red-500/70" /> End-to-End Secure</span>
                  <span className="flex items-center gap-1.5"><Maximize2 className="h-3.5 w-3.5 text-orange-450/70" /> 1080p Stream</span>
                </div>

              </div>
            </div>

          </div>
        ) : (
          // ACTIVE MEETING VIEW (Jitsi overlay is handled globally at root level)
          <div className="flex-1 w-full h-full relative flex flex-col pointer-events-none" />
        )}
      </div>
    </DashboardLayout>
  );
}
