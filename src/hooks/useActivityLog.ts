/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  action_type: string;
  entity_name: string;
  entity_id: string | null;
  description: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export function useActivityLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch recent activity from audit_logs table
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activity_log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as ActivityLogEntry[];
    },
    refetchInterval: 10000,
  });

  // Subscribe to realtime inserts on audit_logs
  useEffect(() => {
    const channel = supabase
      .channel('audit_logs_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['activity_log'] });
          queryClient.invalidateQueries({ queryKey: ['security_audit_logs'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Log a new security audit log
  const securityMutation = useMutation({
    mutationFn: async (entry: {
      action_type: string;
      entity_name: string;
      entity_id?: string;
      description: string;
      metadata?: Record<string, any>;
    }) => {
      let userFullName = 'System';
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profile?.full_name) {
          userFullName = profile.full_name;
        } else {
          userFullName = user.email?.split('@')[0] || 'System';
        }
      }

      const { error } = await supabase.from('audit_logs' as any).insert({
        user_id: user?.id || null,
        action_type: entry.action_type,
        entity_name: entry.entity_name,
        entity_id: entry.entity_id || null,
        description: entry.description,
        metadata: {
          user_name: userFullName,
          ...(entry.metadata || {})
        },
        ip_address: '127.0.0.1'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      queryClient.invalidateQueries({ queryKey: ['security_audit_logs'] });
    },
  });

  const logActivity = (
    action: string,
    entityType: string,
    entityName: string,
    entityId?: string,
    metadata?: Record<string, any>
  ) => {
    const actionType = action.toUpperCase();
    const description = `${action.charAt(0).toUpperCase() + action.slice(1)} ${entityType.replace('_', ' ')} "${entityName}"`;
    securityMutation.mutate({
      action_type: actionType,
      entity_name: entityType.toUpperCase(),
      description,
      entity_id: entityId,
      metadata,
    });
  };

  const logSecurity = (
    actionType: string,
    entityName: string,
    description: string,
    entityId?: string,
    metadata?: Record<string, any>
  ) => {
    securityMutation.mutate({
      action_type: actionType,
      entity_name: entityName,
      description,
      entity_id: entityId,
      metadata,
    });
  };

  return { activities, isLoading, logActivity, logSecurity };
}
