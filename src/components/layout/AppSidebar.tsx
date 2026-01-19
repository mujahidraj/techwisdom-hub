import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  UserCircle,
  DollarSign,
  FileText,
  Settings,
  Building2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  UserCog,
  Briefcase,
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

const mainNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'CRM & Leads', url: '/crm', icon: Users },
  { title: 'Projects', url: '/projects', icon: FolderKanban },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
];

const managementItems = [
  { title: 'Team', url: '/team', icon: UserCircle },
  { title: 'Finances', url: '/finances', icon: DollarSign },
  { title: 'Invoices', url: '/invoices', icon: FileText },
];

const adminItems = [
  { title: 'Users', url: '/users', icon: UserCog },
  { title: 'CMS', url: '/cms', icon: Briefcase },
];

export function AppSidebar() {
  const location = useLocation();
  const { role, user } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  const isActive = (path: string) => location.pathname === path;

  // Filter nav items based on role
  const getVisibleItems = (items: typeof mainNavItems) => {
    if (role === 'client') {
      return items.filter(item => item.url === '/dashboard' || item.url === '/projects' || item.url === '/messages');
    }
    return items;
  };

  const getVisibleManagementItems = () => {
    if (role === 'client') return [];
    if (role === 'employee') {
      return managementItems.filter(item => item.url === '/team');
    }
    return managementItems;
  };

  const getVisibleAdminItems = () => {
    if (role !== 'admin') return [];
    return adminItems;
  };

  return (
    <Sidebar
      className={cn(
        'glass-sidebar transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
      collapsible="icon"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 gradient-primary rounded-lg flex-shrink-0">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg truncate">TechWisdom</h1>
              <p className="text-xs text-muted-foreground">Agency ERP</p>
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
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                        'hover:bg-sidebar-accent/50',
                        isActive(item.url) && 'bg-primary/10 text-primary font-medium'
                      )}
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive(item.url) && 'text-primary')} />
                      {!collapsed && <span>{item.title}</span>}
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
                      <NavLink
                        to={item.url}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                          'hover:bg-sidebar-accent/50',
                          isActive(item.url) && 'bg-primary/10 text-primary font-medium'
                        )}
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/settings"
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  'hover:bg-sidebar-accent/50',
                  isActive('/settings') && 'bg-primary/10 text-primary font-medium'
                )}
                activeClassName="bg-primary/10 text-primary font-medium"
              >
                <Settings className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full justify-center mt-2"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}