import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface SendNotificationParams {
  userId?: string; // Target user
  userIds?: string[]; // Multiple target users
  targetRoles?: ('admin' | 'employee' | 'client')[];
  title: string;
  message: string;
  type?: NotificationType;
  actionLink?: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const sendNotification = async ({
    userId,
    userIds,
    targetRoles,
    title,
    message,
    type = 'info',
    actionLink,
  }: SendNotificationParams) => {





    try {
      let targetUserIds: string[] = [];

      if (userIds && userIds.length > 0) {
        targetUserIds = userIds;
      } else if (userId) {
        targetUserIds = [userId];
      } else if (targetRoles && targetRoles.length > 0) {
        // Find users with these roles
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', targetRoles);
        
        if (roleData) {
          targetUserIds = roleData.map(r => r.user_id);
        }
      } else {
        // Default to admins if nothing specified
        const { data: adminData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');
        
        if (adminData) {
          targetUserIds = adminData.map(r => r.user_id);
        }
      }

      if (targetUserIds.length === 0) return;

      // Insert notifications for each target user
      const notifications = targetUserIds.map(id => ({
        user_id: id,
        title,
        message,
        type,
        action_link: actionLink,
        is_read: false,
      }));

      const { error } = await supabase.from('app_notifications').insert(notifications);
      if (error) throw error;

      // Invalidate queries if we are notifying the current user (this hook is mostly for others though)
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  };

  return { sendNotification };
}

// A direct helper to send notifications that can be imported and used outside React components/hooks
export async function sendNotificationDirect({
  userId,
  userIds,
  targetRoles,
  title,
  message,
  type = 'info',
  actionLink,
}: SendNotificationParams) {
  try {
    let targetUserIds: string[] = [];

    if (userIds && userIds.length > 0) {
      targetUserIds = userIds;
    } else if (userId) {
      targetUserIds = [userId];
    } else if (targetRoles && targetRoles.length > 0) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', targetRoles);
      if (roleData) targetUserIds = roleData.map(r => r.user_id);
    } else {
      const { data: adminData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      if (adminData) targetUserIds = adminData.map(r => r.user_id);
    }

    if (targetUserIds.length === 0) return;

    const notifications = targetUserIds.map(id => ({
      user_id: id,
      title,
      message,
      type,
      action_link: actionLink,
      is_read: false,
    }));

    const { error } = await supabase.from('app_notifications').insert(notifications);
    if (error) throw error;
  } catch (err) {
    console.error('sendNotificationDirect error:', err);
    throw err;
  }
}
