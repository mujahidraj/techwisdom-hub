import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

const TEAM_PRESENCE_TOPIC = 'online-team-presence';

type PresenceListener = (onlineUserIds: string[]) => void;

let presenceChannel: RealtimeChannel | null = null;
let activeUserId: string | null = null;
let currentOnlineUserIds: string[] = [];
const listeners = new Set<PresenceListener>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(currentOnlineUserIds));
};

const teardownChannel = () => {
  if (presenceChannel) {
    void supabase.removeChannel(presenceChannel);
  }
  presenceChannel = null;
  activeUserId = null;
  currentOnlineUserIds = [];
};

const ensureChannel = (userId: string) => {
  if (presenceChannel && activeUserId === userId) return;

  teardownChannel();

  activeUserId = userId;
  const channel = supabase.channel(TEAM_PRESENCE_TOPIC, {
    config: { presence: { key: userId } }
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    currentOnlineUserIds = Object.keys(state);
    notifyListeners();
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ online_at: new Date().toISOString() });
    }
  });

  presenceChannel = channel;
};

export function useTeamPresence() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<string[]>(currentOnlineUserIds);

  useEffect(() => {
    const listener: PresenceListener = (ids) => {
      setOnlineUsers(ids);
    };

    listeners.add(listener);

    if (user?.id) {
      ensureChannel(user.id);
      listener(currentOnlineUserIds);
    } else {
      teardownChannel();
      setOnlineUsers([]);
    }

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        teardownChannel();
      }
    };
  }, [user?.id]);

  return onlineUsers;
}
