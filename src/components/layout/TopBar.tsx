import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

export function TopBar() {
  const navigate = useNavigate();
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
      <header className="h-16 border-b border-border/50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">

        <div className="flex items-center gap-4">
          <SidebarTrigger className="lg:hidden text-primary">
            <Menu className="h-6 w-6" />
          </SidebarTrigger>

          <div className="relative hidden xl:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Search..."
              className="w-40 pl-9 h-10 bg-slate-100/50 dark:bg-slate-900/50 border-transparent hover:bg-white dark:hover:bg-slate-800 transition-all rounded-xl cursor-pointer text-xs"
              readOnly
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
                document.dispatchEvent(event);
              }}
            />
          </div>
        </div>

        {/* CENTERED TEXT NAVIGATION */}
        <nav className="hidden lg:flex items-center gap-10">
          <button onClick={() => navigate('/teamChat')} className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors">Messages</button>
          <button onClick={() => navigate('/meeting')} className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors">Meeting</button>
          <button onClick={() => navigate('/projects')} className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors">Projects</button>
          <button onClick={() => navigate('/ai-hub')} className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors">AI Hub</button>
          <button onClick={() => navigate('/messages')} className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors">Client</button>
        </nav>

        <div className="flex items-center gap-6">
          {/* LIVE CLOCK (12H) */}
          <div className="hidden md:flex flex-col items-end border-r pr-6 border-border/50">
            <div className="text-sm font-black tracking-tighter font-mono text-primary tabular-nums leading-none uppercase">
              {format(currentTime, 'hh:mm:ss a')}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 opacity-60">
              {format(currentTime, 'MMM dd')}
            </div>
          </div>

          {/* Mobile search button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => {
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                metaKey: true,
                bubbles: true,
              });
              document.dispatchEvent(event);
            }}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <NotificationBell />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-8 w-8">
                  {/* Shows image if URL exists, otherwise falls back to initials */}
                  <AvatarImage src={avatarUrl || ''} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium leading-tight">{user?.email}</p>
                  <Badge variant={getRoleBadgeVariant()} className="text-[10px] px-1.5 py-0 h-4 capitalize">
                    {role}
                  </Badge>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <User className="mr-2 h-4 w-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
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