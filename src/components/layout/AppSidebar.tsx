/* eslint-disable @typescript-eslint/no-explicit-any */
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
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
  MessageSquare,
  Handshake,
  UserCog,
  Briefcase,
  StickyNote,
  BarChart3,
  ShieldCheck,
  Calendar,
  Video,
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import logo from "../../assets/techwisdom.png";
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const mainNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'CRM & Leads', url: '/crm', icon: Users },
  { title: 'Projects', url: '/projects', icon: FolderKanban },
  { title: 'Team Chat', url: '/teamChat', icon: MessageSquare, badge: true }, 
  { title: 'Client Interaction', url: '/messages', icon: Handshake }, 
  { title: 'Notes', url: '/notes', icon: StickyNote },
  { title: "Schedule", url: "/events", icon: Calendar },
  { title: "Conference", url: "/meeting", icon: Video },
];

const managementItems = [
  { title: 'Team', url: '/team', icon: UserCircle },
  { title: 'Maintenance', url: '/maintenance', icon: ShieldCheck },
  { title: 'Finances', url: '/finances', icon: DollarSign },
  { title: 'Invoices', url: '/invoices', icon: FileText },
  { title: 'Reports', url: '/reports', icon: BarChart3 },
];

const adminItems = [
  { title: 'Users', url: '/users', icon: UserCog },
  { title: 'CMS', url: '/cms', icon: Briefcase },
];

export function AppSidebar() {
  const location = useLocation();
  const { role, user } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const queryClient = useQueryClient();
  const collapsed = state === 'collapsed';
  
  // Soft iPhone chime
  const SOFT_NOTIFY_SOUND = "dist/techwidom-noti.mp3";

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
 useEffect(() => {
    if (!user?.id) return;

    // 1. Request permission immediately (Electron usually grants this by default)
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel('global_notifications')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'team_messages' 
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['unread_sidebar_count'] });

        if (payload.eventType === 'INSERT' && payload.new.sender_id !== user.id) {
          const isForMe = !payload.new.receiver_id || payload.new.receiver_id === user.id;
          
          if (isForMe) {
            // Play Sound
            const audio = new Audio(SOFT_NOTIFY_SOUND);
            audio.volume = 0.4;
            audio.play().catch(() => {});

            // --- SEND WINDOWS NOTIFICATION ---
            // Only notify if we are NOT on the chat page OR if the window is hidden/minimized
            if (location.pathname !== '/teamChat' || document.hidden) {
              
              // This triggers the native Windows "Toast"
              const notif = new Notification("TechWisdom ERP", {
                body: `New Message: ${payload.new.content}`,
                silent: true, // We already played a custom sound above
              });
              
              // Optional: Click the notification to open the app & go to chat
              notif.onclick = () => {
                // This focuses the Electron window if it's minimized
                window.focus(); 
                // Navigate to chat
                // Note: You might need to use a navigation helper here or just let the user click
              };
            }

            // Show internal toast if inside the app
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

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3">Main</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {getVisibleItems(mainNavItems).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
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
        </SidebarGroup>

        {getVisibleManagementItems().length > 0 && (
          <SidebarGroup className="mt-4">
            {!collapsed && <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3">Management</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {getVisibleManagementItems().map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors', isActive(item.url) && 'bg-primary/10 text-primary font-medium')}>
                        <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive(item.url) && 'text-primary')} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {getVisibleAdminItems().length > 0 && (
          <SidebarGroup className="mt-4">
            {!collapsed && <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3">Admin</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {getVisibleAdminItems().map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors', isActive(item.url) && 'bg-primary/10 text-primary font-medium')}>
                        <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive(item.url) && 'text-primary')} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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