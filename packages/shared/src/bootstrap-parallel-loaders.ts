/**
 * Parallel queries after feed load in `AppContext.loadUserData` — keep one implementation for web/native.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_NOTIFICATIONS_BOOTSTRAP_LIMIT } from './bootstrap-constants';

export type LoadUserDataParallelBundle = {
  adsData: unknown[] | null;
  relationshipsData: unknown[] | null;
  requestsData: unknown[] | null;
  notificationsData: unknown[] | null;
  cheatingAlertsData: unknown[] | null;
  blockedUsersData: unknown[] | null;
  followsData: unknown[] | null;
  disputesData: unknown[] | null;
};

export async function fetchLoadUserDataParallelBundle(
  client: SupabaseClient,
  userId: string
): Promise<LoadUserDataParallelBundle> {
  const [
    { data: adsData },
    { data: relationshipsData },
    { data: requestsData },
    { data: notificationsData },
    { data: cheatingAlertsData },
    { data: blockedUsersData },
    { data: followsData },
    { data: disputesData },
  ] = await Promise.all([
    client
      .from('advertisements')
      .select('*')
      .eq('active', true)
      .eq('status', 'approved')
      .eq('billing_status', 'paid')
      .order('created_at', { ascending: false }),
    client
      .from('relationships')
      .select('*')
      .or(`user_id.eq.${userId},partner_user_id.eq.${userId}`)
      .in('status', ['pending', 'verified']),
    client
      .from('relationship_requests')
      .select('*')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    client
      .from('notifications')
      .select('id,user_id,type,title,message,data,read,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(APP_NOTIFICATIONS_BOOTSTRAP_LIMIT),
    client
      .from('cheating_alerts')
      .select('id,user_id,partner_user_id,alert_type,description,read,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    client.from('blocked_users').select('blocked_id').eq('blocker_id', userId),
    client
      .from('follows')
      .select('id,follower_id,following_id,created_at')
      .or(`follower_id.eq.${userId},following_id.eq.${userId}`),
    client
      .from('disputes')
      .select(
        'id,relationship_id,initiated_by,dispute_type,description,status,resolution,auto_resolve_at,resolved_at,resolved_by,created_at'
      )
      .eq('initiated_by', userId)
      .order('created_at', { ascending: false }),
  ]);

  return {
    adsData: adsData as unknown[] | null,
    relationshipsData: relationshipsData as unknown[] | null,
    requestsData: requestsData as unknown[] | null,
    notificationsData: notificationsData as unknown[] | null,
    cheatingAlertsData: cheatingAlertsData as unknown[] | null,
    blockedUsersData: blockedUsersData as unknown[] | null,
    followsData: followsData as unknown[] | null,
    disputesData: disputesData as unknown[] | null,
  };
}
