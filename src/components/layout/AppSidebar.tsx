/* eslint-disable @typescript-eslint/no-explicit-any */
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  UserCircle,
  DollarSign,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Handshake,
  UserCog,
  Briefcase,
  StickyNote,
  BarChart3,
  ShieldCheck,
  Calendar,
  Video,
  Package,
  Zap,
  Image as ImageIcon,
  UserPlus,
  GitPullRequest,
  CalendarClock,
  Sparkles,
  Target,
  LifeBuoy,
  Megaphone,
  Receipt
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import logo from "../../assets/techwisdom.png";
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const mainNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Projects', url: '/projects', icon: FolderKanban },
  { title: 'Notes', url: '/notes', icon: StickyNote },
  { title: "Schedule", url: "/events", icon: Calendar },
];

const communicationItems = [
  { title: 'Team Chat', url: '/teamChat', icon: MessageSquare, badge: true },
  { title: "Conference", url: "/meeting", icon: Video },
  { title: 'Client Messages', url: '/messages', icon: Handshake },
];

const crmItems = [
  { title: 'Leads Pipeline', url: '/crm', icon: Users },
  { title: 'Proposals & Quotes', url: '/proposals', icon: FileText },
];

const managementItems = [
  { title: 'IT Helpdesk', url: '/helpdesk', icon: LifeBuoy },
  { title: 'OKRs & Goals', url: '/okr', icon: Target },
  { title: 'Assets', url: '/assets', icon: Package },
  { title: 'Maintenance', url: '/maintenance', icon: ShieldCheck },
];

const financeItems = [
  { title: 'Finances', url: '/finances', icon: DollarSign },
  { title: 'Expenses', url: '/expenses', icon: Receipt },
  { title: 'Invoices', url: '/invoices', icon: FileText },
  { title: 'Reports', url: '/reports', icon: BarChart3 },
];

const hrItems = [
  { title: 'Team Directory', url: '/team', icon: UserCircle },
  { title: 'Candidates', url: '/hr/candidates', icon: UserPlus },
  { title: 'ATS Pipeline', url: '/hr/pipeline', icon: GitPullRequest },
  { title: 'Interviews', url: '/hr/interviews', icon: CalendarClock },
  { title: 'Portal Admin', url: '/hr/portal-admin', icon: Megaphone },
];

const adminItems = [
  { title: 'Users', url: '/users', icon: UserCog },
  { title: 'Workflows', url: '/workflows', icon: Zap },
];

const aiItems = [
  { title: 'AI Assistant Hub', url: '/ai-hub', icon: Sparkles },
];

const cmsItems = [
  { title: 'CMS Hub', url: '/cms', icon: Briefcase },
  { title: 'Recruitment', url: '/cms/recruitment', icon: Briefcase },
  { title: 'Demo Projects', url: '/cms/demo-projects', icon: FolderKanban },
  { title: 'Product Catalog', url: '/cms/products', icon: Package },
  { title: 'Team', url: '/cms/team', icon: Users },
  { title: 'Blog', url: '/cms/blog', icon: FileText },
  { title: 'Services', url: '/cms/services', icon: Settings },
  { title: 'Portfolio', url: '/cms/portfolio', icon: FolderKanban },
  { title: 'Partners', url: '/cms/partners', icon: Handshake },
  { title: 'Gallery', url: '/cms/gallery', icon: ImageIcon },
  { title: 'Timeline', url: '/cms/timeline', icon: Calendar },
  { title: 'Pricing', url: '/cms/pricing', icon: DollarSign },
];

const CollapsibleSidebarGroup = ({
  title,
  items,
  collapsed,
  isActive,
  unreadCount = 0
}: {
  title: string;
  items: any[];
  collapsed: boolean;
  isActive: (url: string) => boolean;
  unreadCount?: number;
}) => {
  if (items.length === 0) return null;

  return (
    <Collapsible defaultOpen className="group/collapsible mt-4 first:mt-0">
      <SidebarGroup>
        {!collapsed && (
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3 hover:bg-sidebar-accent cursor-pointer transition-colors flex items-center justify-between w-full">
              {title}
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
            </SidebarGroupLabel>
          </CollapsibleTrigger>
        )}
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/cms'}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative',
                        'hover:bg-sidebar-accent/50',
                        isActive(item.url) && 'bg-primary/10 text-primary font-medium'
                      )}
                    >
                      <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive(item.url) && 'text-primary')} />
                      {!collapsed && <span>{item.title}</span>}

                      {item.badge && unreadCount > 0 && (
                        <div className={cn(
                          "absolute flex items-center justify-center rounded-full bg-red-600 text-white font-bold animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.9)]",
                          collapsed ? "top-1 right-1 h-2 w-2" : "right-3 h-5 min-w-[20px] px-1.5 text-[10px]"
                        )}>
                          {!collapsed && unreadCount}
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
};

export function AppSidebar() {
  const location = useLocation();
  const { role, user } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const queryClient = useQueryClient();
  const collapsed = state === 'collapsed';

  // Soft iPhone chime
  const SOFT_NOTIFY_SOUND = "techwidom-noti.mp3";

  // --- GLOWING UNREAD COUNT LOGIC ---
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread_sidebar_count', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // FIX: Precision filtering - Count only if (Not me) AND (Not Seen) AND (General OR For Me)
      const { count, error } = await supabase
        .from('team_messages')
        .select('id', { count: 'exact', head: true })
        .not('seen_by', 'cs', `{${user?.id}}`)
        .neq('sender_id', user?.id)
        .or(`receiver_id.is.null,receiver_id.eq.${user?.id}`); // FIX: Prevents seeing counts for others' private chats

      if (error) return 0;
      return count || 0;
    },
    refetchOnWindowFocus: true
  });

  // Global Notification Listener
// --- NOTIFICATION LISTENER (Mobile & Web Merged) ---
// --- NOTIFICATION & SOUND LISTENER ---
useEffect(() => {
    if (!user?.id) return;

    // 1. Web Permission Request (Your original logic - UNTOUCHED)
    if (typeof window.Notification !== 'undefined' && window.Notification.permission !== "granted") {
      try {
        window.Notification.requestPermission();
      } catch (e) {
        console.log("Notifications not supported");
      }
    }

    // 2. Mobile Setup (ADDED: Defines the missing function)
    const setupMobileNotifications = async () => {
      try {
        await LocalNotifications.requestPermissions();
        
        // Create "Urgent" Channel to force System Sound & Status Bar
        await LocalNotifications.createChannel({
            id: 'urgent_alerts_v3', // Match this ID in the schedule block below
            name: 'Urgent Messages',
            importance: 5,          // 5 = Max (Heads-up Display)
            visibility: 1,
            vibration: true,
            sound: undefined        // Force System Default Sound
        });
      } catch (e) { 
        // Not on mobile
      }
    };
    
    // Call the function we just defined
    setupMobileNotifications();

    // 3. Listen for Messages
    const channel = supabase
      .channel('global_notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_messages'
      }, async (payload) => { 
        
        queryClient.invalidateQueries({ queryKey: ['unread_sidebar_count'] });

        if (payload.eventType === 'INSERT' && payload.new.sender_id !== user.id) {
          const isForMe = !payload.new.receiver_id || payload.new.receiver_id === user.id;

          if (isForMe) {
            
            // A. Play Web/In-App Sound (Your original logic - UNTOUCHED)
            try {
                const audio = new Audio('/techwidom-noti.mp3'); 
                audio.volume = 1.0; 
                audio.play().catch(() => { });
            } catch(e) { /* empty */ }

            // B. --- MOBILE NOTIFICATION (Fixed) ---
            if (location.pathname !== '/teamChat' || document.hidden) {
                try {
                    await LocalNotifications.schedule({
                        notifications: [
                            {
                                title: "TechWisdom ERP",
                                body: `New Message: ${payload.new.content}`,
                                id: new Date().getTime(),
                                schedule: { at: new Date(Date.now() + 100) },
                                channelId: 'urgent_alerts_v3', // <--- MATCHES THE NEW ID
                                // smallIcon line REMOVED (Uses default App Icon automatically)
                                // sound line REMOVED (Uses Channel Default automatically)
                            }
                        ]
                    });
                } catch (e) {
                    console.log("Mobile notification skipped");
                }
            }

            // C. --- WINDOWS/WEB NOTIFICATION (Your original logic - UNTOUCHED) ---
            if (typeof window.Notification !== 'undefined') {
              try {
                const notif = new window.Notification("TechWisdom ERP", {
                  body: `New Message: ${payload.new.content}`,
                  silent: true,
                });
                notif.onclick = () => { window.focus(); };
              } catch (e) {
                console.log("Native notifications skipped");
              }
            }

            // D. Show Toast (Your original logic - UNTOUCHED)
            if (location.pathname !== '/teamChat' && !document.hidden) {
              toast.info("New Team Message", {
                description: payload.new.content?.substring(0, 30) + "...",
              });
            }
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient, location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  const getVisibleItems = (items: typeof mainNavItems) => {
    if (role === 'client') {
      return items.filter(item =>
        ['/dashboard', '/projects', '/messages', '/notes', '/meeting'].includes(item.url)
      );
    }
    return items;
  };

  const getVisibleManagementItems = () => {
    if (role === 'client') return [];
    if (role === 'employee') return managementItems.filter(item => item.url === '/team');
    return managementItems;
  };

  const getVisibleAdminItems = () => (role === 'admin' ? adminItems : []);
  
  const getVisibleFinanceItems = () => (role === 'admin' ? financeItems : []);

  const getVisibleCommunicationItems = () => {
    if (role === 'client') return communicationItems.filter(i => i.url === '/messages' || i.url === '/meeting');
    return communicationItems;
  };

  return (
    <Sidebar className={cn('glass-sidebar transition-all duration-300', collapsed ? 'w-16' : 'w-64')} collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex flex-row items-left gap-3">
          <div className="p-2 gradient-primary rounded-lg flex-shrink-0">
            <img src={logo} className='h-10' alt="TechWisdom Logo" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg truncate">TechWisdom</h1>
              <p className="text-xs text-muted-foreground">Organizational ERP</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pb-6">
        <CollapsibleSidebarGroup title="Main" items={getVisibleItems(mainNavItems)} collapsed={collapsed} isActive={isActive} />
        <CollapsibleSidebarGroup title="Communication" items={getVisibleCommunicationItems()} collapsed={collapsed} isActive={isActive} unreadCount={unreadCount} />
        <CollapsibleSidebarGroup title="CRM & Sales" items={crmItems} collapsed={collapsed} isActive={isActive} />
        <CollapsibleSidebarGroup title="Management" items={getVisibleManagementItems()} collapsed={collapsed} isActive={isActive} />
        <CollapsibleSidebarGroup title="Finance & Accounting" items={getVisibleFinanceItems()} collapsed={collapsed} isActive={isActive} />
        {(role === 'admin' || role === 'employee') && (
          <CollapsibleSidebarGroup title="Human Resources" items={hrItems} collapsed={collapsed} isActive={isActive} />
        )}
        <CollapsibleSidebarGroup title="Admin" items={getVisibleAdminItems()} collapsed={collapsed} isActive={isActive} />
        {role === 'admin' && (
          <CollapsibleSidebarGroup title="Artificial Intelligence" items={aiItems} collapsed={collapsed} isActive={isActive} />
        )}
        {role === 'admin' && (
          <CollapsibleSidebarGroup title="CMS (Content)" items={cmsItems} collapsed={collapsed} isActive={isActive} />
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <Button variant="ghost" size="sm" onClick={toggleSidebar} className="w-full justify-center mt-2">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}