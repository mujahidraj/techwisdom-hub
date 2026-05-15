import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

// --- IMPORT THE ERROR BOUNDARY ---
import ErrorBoundary from "@/components/ErrorBoundary"; 

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

// AI Hub
import AIHub from "./pages/ai/AIHub";

// OKR
import OKRDashboard from "./pages/okr/OKRDashboard";

// Proposals
import ProposalsDashboard from "./pages/proposals/ProposalsDashboard";

// Helpdesk
import HelpdeskAdmin from "./pages/helpdesk/HelpdeskAdmin";

// Settings
import NotificationPreferences from "./pages/settings/NotificationPreferences";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </Router>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;