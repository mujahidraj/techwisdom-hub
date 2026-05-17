import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, LogOut, User, Menu, Building2, MessageSquare, Video, FolderKanban, Bot, Mail } from 'lucide-react'; // Added icons for TopBar nav
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client'; // Added Supabase client
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Added AvatarImage
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { format } from 'date-fns';
import { GlobalSearch } from '@/components/GlobalSearch';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { GlobalCalendarPop } from '@/components/layout/GlobalCalendarPop';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Messages', path: '/teamChat' },
  { label: 'Meeting', path: '/meeting' },
  { label: 'Projects', path: '/projects' },
  { label: 'AI Hub', path: '/ai-hub' },
  { label: 'Client', path: '/messages' },
];

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signOut } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live Clock Effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch the user's avatar when the component loads
  useEffect(() => {
    async function getProfile() {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (data?.avatar_url) {
        // If it's already an absolute URL, use it directly
        if (data.avatar_url.startsWith('http')) {
          setAvatarUrl(data.avatar_url);
        } else {
          // Otherwise, transform the filepath into a public URL
          const { data: publicData } = supabase.storage
            .from('avatars')
            .getPublicUrl(data.avatar_url);

          setAvatarUrl(publicData.publicUrl);
        }
      }
    }

    getProfile();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = () => {
    const email = user?.email || '';
    return email.substring(0, 2).toUpperCase();
  };

  const getRoleBadgeVariant = () => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'employee':
        return 'secondary';
      case 'client':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <>
      <GlobalSearch />
      <header className="h-16 border-b border-border/40 bg-background/60 backdrop-blur-2xl flex items-center justify-between px-6 sticky top-0 z-40 shadow-[0_4px_32px_rgba(0,0,0,0.02)] transition-all duration-300">

        <div className="flex items-center gap-4">
          <SidebarTrigger className="lg:hidden text-primary">
            <Menu className="h-6 w-6" />
          </SidebarTrigger>

          <div className="relative hidden 2xl:block group/search">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 transition-colors duration-300 group-hover/search:text-primary" />
            <Input
              placeholder="Search anything..."
              className="w-64 pl-10 pr-12 h-11 bg-card/40 border-border/50 hover:bg-card/80 hover:border-primary/30 focus:border-primary/50 focus:bg-card transition-all duration-300 rounded-2xl cursor-pointer text-sm shadow-sm"
              readOnly
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
                document.dispatchEvent(event);
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-row items-center gap-1 opacity-60 pointer-events-none select-none whitespace-nowrap">
              <kbd className="bg-muted px-1.5 py-0.5 rounded-md text-[10px] font-semibold border border-border/50">⌘</kbd>
              <kbd className="bg-muted px-1.5 py-0.5 rounded-md text-[10px] font-semibold border border-border/50">K</kbd>
            </div>
          </div>
        </div>

        {/* CENTERED PILL NAVIGATION */}
        <nav className="hidden xl:flex items-center gap-1 p-1.5 bg-card/30 backdrop-blur-md rounded-2xl border border-border/40 shadow-inner flex-shrink-0">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button 
                key={item.label}
                onClick={() => navigate(item.path)} 
                className={cn(
                  "relative px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 overflow-hidden group/nav whitespace-nowrap flex-shrink-0",
                  isActive ? "text-primary shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-card/80 hover:shadow-sm"
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl transition-all duration-300" />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-6">
          {/* LIVE CLOCK */}
          <GlobalCalendarPop>
            <div className="hidden md:flex flex-col items-end px-4 py-1.5 bg-card/40 rounded-xl border border-border/50 shadow-sm transition-all duration-300 hover:bg-card/80 hover:border-primary/30 cursor-pointer group/clock">
              <div className="text-[15px] font-extrabold tracking-tight font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tabular-nums leading-none group-hover/clock:scale-105 transition-transform duration-300 whitespace-nowrap">
                {format(currentTime, 'hh:mm:ss a')}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 opacity-70 group-hover/clock:text-primary transition-colors duration-300 whitespace-nowrap">
                {format(currentTime, 'MMM dd, yyyy')}
              </div>
            </div>
          </GlobalCalendarPop>

          {/* Mobile search button */}
          <Button
            variant="ghost"
            size="icon"
            className="2xl:hidden bg-card/40 border border-border/50 rounded-xl hover:bg-card/80 hover:border-primary/30 transition-all duration-300 shadow-sm"
            onClick={() => {
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                metaKey: true,
                bubbles: true,
              });
              document.dispatchEvent(event);
            }}
          >
            <Search className="h-5 w-5 text-muted-foreground" />
          </Button>

          {/* Notifications */}
          <div className="p-1 bg-card/40 rounded-xl border border-border/50 shadow-sm hover:bg-card/80 hover:border-primary/30 transition-all duration-300">
            <NotificationBell />
          </div>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3 px-3 py-2 h-auto bg-card/30 hover:bg-card/80 rounded-2xl transition-all duration-300 border border-border/40 hover:border-primary/30 shadow-sm group">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <p className="text-sm font-bold leading-tight text-foreground/90 group-hover:text-primary transition-colors">{user?.email?.split('@')[0]}</p>
                  <Badge variant={getRoleBadgeVariant()} className="text-[9px] px-2 py-0 h-4 capitalize mt-0.5 shadow-sm font-bold tracking-wider">
                    {role}
                  </Badge>
                </div>
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-secondary rounded-full opacity-40 blur-sm group-hover:opacity-70 transition-opacity duration-300" />
                  <Avatar className="h-10 w-10 ring-2 ring-background relative z-10 shadow-md transform group-hover:scale-105 transition-transform duration-300">
                    <AvatarImage src={avatarUrl || ''} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-border/50 shadow-xl backdrop-blur-md bg-card/95">
              <DropdownMenuLabel className="font-bold text-muted-foreground">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={() => navigate('/settings')} className="rounded-lg cursor-pointer font-medium hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary transition-colors mb-1">
                <User className="mr-2 h-4 w-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="rounded-lg cursor-pointer font-medium text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive transition-colors">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
}