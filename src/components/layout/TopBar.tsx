import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LogOut, User, Menu, Building2 } from 'lucide-react'; // Added Building2 for Logo
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
import { GlobalSearch } from '@/components/GlobalSearch';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export function TopBar() {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="lg:hidden">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>

          {/* --- BRANDING / LOGO --- */}
          <div className="flex items-center gap-2 mr-2 lg:hidden"> 
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-lg hidden sm:block">TechWisdom</span>
          </div>
          {/* ----------------------- */}

          {/* Search - opens CMD+K dialog */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads, projects... (⌘K)"
              className="w-72 pl-9 h-9 bg-muted/50 border-transparent focus:border-primary/50 cursor-pointer"
              readOnly
              onClick={() => {
                const event = new KeyboardEvent('keydown', {
                  key: 'k',
                  metaKey: true,
                  bubbles: true,
                });
                document.dispatchEvent(event);
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
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