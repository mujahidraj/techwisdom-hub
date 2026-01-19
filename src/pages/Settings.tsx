import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { User, Bell, Shield, Palette, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile Information
            </CardTitle>
            <CardDescription>Update your personal details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={role || ''} disabled className="bg-muted capitalize" />
              </div>
            </div>
            <div>
              <Label>Full Name</Label>
              <Input placeholder="Enter your full name" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input placeholder="+1 (555) 000-0000" />
            </div>
            <Button className="gradient-primary">Save Changes</Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>Configure how you receive notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Lead Updates</p>
                <p className="text-sm text-muted-foreground">Get notified when leads change status</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Project Milestones</p>
                <p className="text-sm text-muted-foreground">Alerts for project stage changes</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Switch to dark theme</p>
              </div>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible account actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}