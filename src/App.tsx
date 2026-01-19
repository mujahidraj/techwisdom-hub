import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import Finances from "./pages/Finances";
import Invoices from "./pages/Invoices";
import Settings from "./pages/Settings";
import ClientPortal from "./pages/ClientPortal";
import EmployeePortal from "./pages/EmployeePortal";
import UserManagement from "./pages/UserManagement";
import Messaging from "./pages/Messaging";
import CMS from "./pages/CMS";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/team" element={<Team />} />
            <Route path="/finances" element={<Finances />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/client-portal" element={<ClientPortal />} />
            <Route path="/employee-portal" element={<EmployeePortal />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/messages" element={<Messaging />} />
            <Route path="/cms" element={<CMS />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;