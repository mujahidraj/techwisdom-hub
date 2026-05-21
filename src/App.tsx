import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useTeamPresence } from "@/hooks/useTeamPresence";
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Maximize2, PhoneOff, ShieldAlert, Copy, Check, ExternalLink, Terminal } from 'lucide-react';

// --- IMPORT THE ERROR BOUNDARY ---
import ErrorBoundary from "@/components/ErrorBoundary"; 

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
    startGlobalMeeting?: (type: 'audio' | 'video') => void;
    hangupGlobalMeeting?: () => void;
    __activeMeeting?: any;
  }
}

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import Finances from "./pages/Finances";
import Expenses from "./pages/finance/Expenses";
import Invoices from "./pages/Invoices";
import Settings from "./pages/Settings";
import ClientPortal from "./pages/ClientPortal";
import EmployeePortal from "./pages/EmployeePortal";
import UserManagement from "./pages/UserManagement";
import Messaging from "./pages/Messaging";
import Maintenance from './pages/Maintenance';
import OrganizationalAudit from './pages/admin/OrganizationalAudit';
import SecurityAudit from './pages/admin/SecurityAudit';
import TimeAudit from './pages/admin/TimeAudit';
import FinancialReconciliationAudit from './pages/admin/FinancialReconciliationAudit';
import CMS from "./pages/CMS";
import Notes from "./pages/Notes";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import LeadDetails from "./pages/LeadDetails";
import EventsTasks from "./pages/EventsTasks";
import ProjectDetails from "./pages/ProjectDetails";
import Meeting from "./pages/Meeting";
import Messages from "./pages/Messages";
import Assets from "./pages/Assets";
import Workflows from "./pages/Workflows";
import CMSRecruitment from "./pages/cms/CMSRecruitment";
import CMSDemoProjects from "./pages/cms/CMSDemoProjects";
import CMSProducts from "./pages/cms/CMSProducts";
import CMSTeam from "./pages/cms/CMSTeam";
import CMSBlog from "./pages/cms/CMSBlog";
import CMSServices from "./pages/cms/CMSServices";
import CMSPortfolio from "./pages/cms/CMSPortfolio";
import CMSPartners from "./pages/cms/CMSPartners";
import CMSGallery from "./pages/cms/CMSGallery";
import CMSTimeline from "./pages/cms/CMSTimeline";
import CMSPricing from "./pages/cms/CMSPricing";
import CMSSiteInfo from "./pages/cms/CMSSiteInfo";
import CMSNavigation from "./pages/cms/CMSNavigation";
import CMSHero from "./pages/cms/CMSHero";
import CMSStats from "./pages/cms/CMSStats";
import CMSWhyUs from "./pages/cms/CMSWhyUs";
import CMSAbout from "./pages/cms/CMSAbout";
import CMSCostEstimator from "./pages/cms/CMSCostEstimator";
import CMSProcess from "./pages/cms/CMSProcess";
import CMSContact from "./pages/cms/CMSContact";
import CMSFooter from "./pages/cms/CMSFooter";
import CMSNotFound from "./pages/cms/CMSNotFound";
import CMSCareerPage from "./pages/cms/CMSCareerPage";
import CMSCareerPerks from "./pages/cms/CMSCareerPerks";

// HR / ATS Imports
import Candidates from "./pages/hr/Candidates";
import ATSPipeline from "./pages/hr/ATSPipeline";
import Interviews from "./pages/hr/Interviews";
import PortalAdmin from "./pages/hr/PortalAdmin";
import PerformanceReviews from "./pages/hr/PerformanceReviews";
import Leave from "./pages/hr/Leave";
import Payroll from "./pages/hr/Payroll";

// DMS
import DocumentManagement from "./pages/dms/DocumentManagement";

// AI Hub
import AIHub from "./pages/ai/AIHub";

// OKR
import OKRDashboard from "./pages/okr/OKRDashboard";

// Proposals
import ProposalsDashboard from "./pages/proposals/ProposalsDashboard";

// Helpdesk
import HelpdeskAdmin from "./pages/helpdesk/HelpdeskAdmin";

// New Features
import TaskKanban from "./pages/TaskKanban";
import KPIDashboard from "./pages/KPIDashboard";

// Settings
import NotificationPreferences from "./pages/settings/NotificationPreferences";

const GlobalPresenceTracker = () => {
  useTeamPresence();

  return null;
};

const GlobalMeetingOverlay = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const globalJitsiRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<any>(null);

  // Synchronize state and expose window controls
  useEffect(() => {
    const startGlobalMeeting = (type: 'audio' | 'video') => {
      setActiveMeeting({ joined: true, type });

      // Clean up previous scripts if any
      const existingScript = document.getElementById('jitsi-external-api-global');
      if (existingScript) existingScript.remove();

      const script = document.createElement("script");
      script.src = "https://jitsi.riot.im/external_api.js";
      script.async = true;
      script.id = 'jitsi-external-api-global';
      script.onload = () => {
        if (!window.JitsiMeetExternalAPI || !globalJitsiRef.current) return;
        globalJitsiRef.current.innerHTML = "";

        const options = {
          roomName: "TechWisdom-ERP-Global-Sync-9988",
          width: "100%",
          height: "100%",
          parentNode: globalJitsiRef.current,
          lang: "en",
          configOverwrite: {
            startWithAudioMuted: true,
            startWithVideoMuted: true,
            prejoinPageEnabled: false,
            requireDisplayName: false,
            disableDeepLinking: true,
            enableLobbyChat: false,
            backgroundAlpha: 0,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: '#090d16',
          }
        };

        const jitsiApi = new window.JitsiMeetExternalAPI("jitsi.riot.im", options);
        
        if (user?.email) {
          jitsiApi.executeCommand('displayName', user.email.split('@')[0]);
        }

        setApi(jitsiApi);
        window.__activeMeeting = { joined: true, type };
        window.dispatchEvent(new CustomEvent('meetingStateChange'));
      };
      document.body.appendChild(script);
    };

    const hangupGlobalMeeting = () => {
      if (api) {
        api.dispose();
      }
      setApi(null);
      setActiveMeeting(null);
      window.__activeMeeting = null;
      if (globalJitsiRef.current) {
        globalJitsiRef.current.innerHTML = "";
      }
      window.dispatchEvent(new CustomEvent('meetingStateChange'));
    };

    window.startGlobalMeeting = startGlobalMeeting;
    window.hangupGlobalMeeting = hangupGlobalMeeting;

    const handleStateChange = () => {
      setActiveMeeting(window.__activeMeeting);
    };
    window.addEventListener('meetingStateChange', handleStateChange);

    return () => {
      window.removeEventListener('meetingStateChange', handleStateChange);
    };
  }, [api, activeMeeting, user]);

  if (!activeMeeting?.joined) return null;

  const isMeetingPage = location.pathname === '/meeting';

  return (
    <div 
      className={cn(
        "z-[200] transition-all duration-500 ease-in-out border border-white/10 shadow-2xl overflow-hidden pointer-events-auto",
        isMeetingPage 
          ? "fixed inset-y-0 right-0 left-0 lg:left-64 bg-[#090d16]" 
          : "fixed bottom-6 right-6 w-80 h-48 rounded-2xl bg-[#090d16]/95 backdrop-blur-md scale-100 hover:scale-[1.03] z-[200]"
      )}
    >
      <div ref={globalJitsiRef} className="w-full h-full" />
      
      {/* Standalone Circular Disconnect Button on the Left (NO bar type thing) */}
      {isMeetingPage && (
        <Button
          variant="destructive"
          onClick={window.hangupGlobalMeeting}
          className="absolute top-4 left-4 h-12 w-12 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl active:scale-95 transition-all flex items-center justify-center border border-red-400/20 z-50 pointer-events-auto shadow-red-950/40"
          title="Leave Meeting"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      )}

      {/* Minimized PIP Floating Controller Overlay */}
      {!isMeetingPage && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 flex justify-between items-center gap-2 z-50">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[10px] font-black text-white uppercase tracking-wider truncate">
              Live Conference
            </span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10" 
              onClick={() => navigate('/meeting')}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button 
              size="icon" 
              variant="destructive" 
              className="h-7 w-7 rounded-lg bg-red-650 hover:bg-red-500 text-white border border-red-500/10" 
              onClick={window.hangupGlobalMeeting}
            >
              <PhoneOff className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const queryClient = new QueryClient();

const SupabaseConfigWarning = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const envVariables = [
    {
      key: "VITE_SUPABASE_URL",
      value: "https://jhlmpbhvsddswgycgahm.supabase.co",
      desc: "Connects your frontend to your Supabase database server."
    },
    {
      key: "VITE_SUPABASE_PUBLISHABLE_KEY",
      value: "sb_publishable_4QlKcHk95VzeHy49GPOBZA_3KP_yMdv",
      desc: "Allows secure, client-side queries to Supabase."
    },
    {
      key: "VITE_GROQ_API_KEY",
      value: "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",
      desc: "Powers the AI Assistant Hub and Daily Briefing generators."
    }
  ];

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#060813] text-slate-100 flex items-center justify-center p-4 md:p-8 font-sans selection:bg-rose-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(192,7,7,0.15),rgba(255,255,255,0))]" />
      
      <div className="w-full max-w-3xl glass-card border border-rose-500/20 bg-slate-950/75 p-6 md:p-10 rounded-[28px] shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-5 border-b border-white/5 pb-6 mb-8">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 shadow-lg shadow-rose-950/20 animate-pulse">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">System Configuration Required</h1>
            <p className="text-sm text-slate-400 mt-1 font-semibold">Your Vercel deployment is active, but missing critical environment variables.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Terminal className="h-4.5 w-4.5 text-rose-400" />
              Why is this page showing up instead of a blank screen?
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              Previously, missing Supabase credentials caused a silent crash on startup, leaving a blank white page. 
              We have stabilized the system so it boots gracefully and provides you with the exact values you need to configure your live site instantly!
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Missing Variables (Copy & Paste to Vercel):</h3>
            
            <div className="grid gap-3.5">
              {envVariables.map((variable) => (
                <div key={variable.key} className="bg-slate-900/60 border border-white/5 p-4.5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:bg-slate-900/80">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-400 select-all truncate">{variable.key}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/15 shrink-0">Required</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold">{variable.desc}</p>
                    <div className="bg-black/45 border border-white/5 px-3 py-2 rounded-xl mt-2 flex items-center justify-between gap-3 font-mono text-[11px] text-slate-350 select-all truncate w-full">
                      <span className="truncate">{variable.value}</span>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleCopy(variable.key, variable.value)}
                    className="shrink-0 rounded-xl h-9 px-4 border-white/10 hover:bg-white/5 active:scale-95 transition-all text-xs font-bold"
                  >
                    {copiedKey === variable.key ? (
                      <span className="text-emerald-400 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Copied!</span>
                    ) : (
                      <span className="flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" /> Copy Value</span>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-rose-500/5 border border-rose-500/15 p-5 rounded-2xl space-y-3 mt-6">
            <h4 className="text-xs font-black uppercase tracking-wider text-rose-400">Quick Configuration Steps:</h4>
            <ol className="text-xs text-slate-350 space-y-2 leading-relaxed list-decimal list-inside font-semibold">
              <li>Open your <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-white hover:underline inline-flex items-center gap-1 font-bold">Vercel Dashboard <ExternalLink className="h-3 w-3" /></a> and select the project.</li>
              <li>Go to <strong>Settings</strong> &gt; <strong>Environment Variables</strong>.</li>
              <li>Add the three keys and values displayed above.</li>
              <li>Go to the <strong>Deployments</strong> tab, click the three dots on your latest deployment, and click <strong>Redeploy</strong>.</li>
            </ol>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          <span>System State: Graceful Offline Fallback</span>
          <span>TechWisdom ERP V4</span>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const isSupabaseConfigured = 
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!isSupabaseConfigured) {
    return <SupabaseConfigWarning />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <GlobalPresenceTracker />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Router>
          {/* WRAP ROUTES IN ERROR BOUNDARY TO CATCH CRASHES */}
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/team" element={<Team />} />
              <Route path="/finances" element={<Finances />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/client-portal" element={<ClientPortal />} />
              <Route path="/employee-portal" element={<EmployeePortal />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/admin/audit" element={<OrganizationalAudit />} />
              <Route path="/admin/security" element={<SecurityAudit />} />
              <Route path="/admin/time" element={<TimeAudit />} />
              <Route path="/admin/reconciliation" element={<FinancialReconciliationAudit />} />
              <Route path="/messages" element={<Messaging />} />
              <Route path="/cms" element={<CMS />} />
              <Route path="/cms/recruitment" element={<CMSRecruitment />} />
              <Route path="/cms/demo-projects" element={<CMSDemoProjects />} />
              <Route path="/cms/products" element={<CMSProducts />} />
              <Route path="/cms/team" element={<CMSTeam />} />
              <Route path="/cms/blog" element={<CMSBlog />} />
              <Route path="/cms/services" element={<CMSServices />} />
              <Route path="/cms/portfolio" element={<CMSPortfolio />} />
              <Route path="/cms/partners" element={<CMSPartners />} />
              <Route path="/cms/gallery" element={<CMSGallery />} />
              <Route path="/cms/timeline" element={<CMSTimeline />} />
              <Route path="/cms/pricing" element={<CMSPricing />} />
              <Route path="/cms/site-info" element={<CMSSiteInfo />} />
              <Route path="/cms/navigation" element={<CMSNavigation />} />
              <Route path="/cms/hero" element={<CMSHero />} />
              <Route path="/cms/stats" element={<CMSStats />} />
              <Route path="/cms/why-us" element={<CMSWhyUs />} />
              <Route path="/cms/about" element={<CMSAbout />} />
              <Route path="/cms/cost-estimator" element={<CMSCostEstimator />} />
              <Route path="/cms/process" element={<CMSProcess />} />
              <Route path="/cms/contact" element={<CMSContact />} />
              <Route path="/cms/footer" element={<CMSFooter />} />
              <Route path="/cms/not-found" element={<CMSNotFound />} />
              <Route path="/cms/career-page" element={<CMSCareerPage />} />
              <Route path="/cms/career-perks" element={<CMSCareerPerks />} />
              <Route path="/hr/candidates" element={<Candidates />} />
              <Route path="/hr/pipeline" element={<ATSPipeline />} />
              <Route path="/hr/interviews" element={<Interviews />} />
              <Route path="/hr/portal-admin" element={<PortalAdmin />} />
              <Route path="/hr/reviews" element={<PerformanceReviews />} />
              <Route path="/hr/leave" element={<Leave />} />
              <Route path="/hr/payroll" element={<Payroll />} />
              <Route path="/dms" element={<DocumentManagement />} />
              <Route path="/ai-hub" element={<AIHub />} />
              <Route path="/okr" element={<OKRDashboard />} />
              <Route path="/proposals" element={<ProposalsDashboard />} />
              <Route path="/helpdesk" element={<HelpdeskAdmin />} />
              <Route path="/settings/notifications" element={<NotificationPreferences />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/crm/:id" element={<LeadDetails />} />
              <Route path="/events" element={<EventsTasks />} />
              <Route path="/projects/:id" element={<ProjectDetails />} />
              <Route path="/meeting" element={<Meeting />} />
              <Route path="/teamChat" element={<Messages />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="/workflows" element={<Workflows />} />
              <Route path="/kanban" element={<TaskKanban />} />
              <Route path="/kpi" element={<KPIDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
          <GlobalMeetingOverlay />
        </Router>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;