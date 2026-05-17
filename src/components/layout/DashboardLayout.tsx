import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIChatButton } from '@/components/AIChatButton';
import { useWorkflowEngine } from '@/hooks/useWorkflowEngine';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, role } = useAuth();
  useWorkflowEngine();

  useEffect(() => {
    // Only handle unauthenticated redirects here
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // HARD UI FIREWALL: Render-blocking role checks
  if (role === 'client') {
    return <Navigate to="/client-portal" replace />;
  }

  const isEmployeeRoute =
    location.pathname.startsWith('/teamChat') ||
    location.pathname.startsWith('/meeting') ||
    location.pathname.startsWith('/projects');

  if (role === 'employee' && !isEmployeeRoute) {
    return <Navigate to="/employee-portal" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {role === 'admin' && <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          {role === 'admin' ? (
            <TopBar />
          ) : (
            <header className="h-16 flex items-center px-6 border-b bg-card">
              <Button variant="ghost" onClick={() => navigate('/employee-portal')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Portal
              </Button>
            </header>
          )}
          <main className="flex-1 p-6 overflow-auto relative">
            {children}
          </main>
          {role === 'admin' && <AIChatButton />}
        </div>
      </div>
    </SidebarProvider>
  );
}