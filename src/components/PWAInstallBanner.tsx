import { useState } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Bell, BellOff, X, Smartphone, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function PWAInstallBanner() {
  const {
    isInstallable, isInstalled, promptInstall,
    notificationPermission, requestNotificationPermission,
    sendPushNotification
  } = usePWA();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('pwa-banner-dismissed') === 'true';
  });

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  if (dismissed) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 shadow-lg shadow-primary/5 overflow-hidden relative">
      <Button
        variant="ghost" size="icon"
        className="absolute top-2 right-2 h-6 w-6 z-10 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold">Enhance Your Experience</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isInstallable ? 'Install TechWisdom as a desktop app for faster access.' : ''}
              {notificationPermission !== 'granted' ? ' Enable notifications to stay updated.' : 'Your notifications are fully active!'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isInstallable && !isInstalled && (
            <Button
              size="sm"
              className="gradient-primary text-xs gap-1.5 flex-1 sm:flex-none"
              onClick={async () => {
                const accepted = await promptInstall();
                if (accepted) toast.success('TechWisdom ERP installed!');
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Install App
            </Button>
          )}
          {isInstalled && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Installed
            </Badge>
          )}
          {notificationPermission === 'default' && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 flex-1 sm:flex-none"
              onClick={async () => {
                const granted = await requestNotificationPermission();
                if (granted) {
                  toast.success('Push notifications enabled!');
                } else {
                  toast.error('Notification permission denied');
                }
              }}
            >
              <Bell className="h-3.5 w-3.5" />
              Enable Notifications
            </Button>
          )}
          {notificationPermission === 'granted' && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 flex-1 sm:flex-none text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100/50"
              onClick={async () => {
                await sendPushNotification('TechWisdom ERP 🚀', 'Push notifications are live and working perfectly!');
                toast.success('Test notification triggered!');
              }}
            >
              <Bell className="h-3.5 w-3.5" />
              Test Push Notification
            </Button>
          )}
          {notificationPermission === 'denied' && (
            <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 gap-1">
              <BellOff className="h-3 w-3" /> Blocked
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
