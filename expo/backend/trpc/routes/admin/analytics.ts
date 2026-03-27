import { adminProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getAnalyticsProcedure = adminProcedure.query(async ({ ctx }) => {
  const authHeader = ctx.req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const supabase = getSupabaseAuthedClient(token);
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const { count: activeUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte(
      'updated_at',
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    );

  const { count: verifiedRelationships } = await supabase
    .from('relationships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'verified');

  const { count: pendingRelationships } = await supabase
    .from('relationships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: activeDisputes } = await supabase
    .from('disputes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: reportedContent } = await supabase
    .from('reported_content')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: cheatingAlerts } = await supabase
    .from('cheating_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);

  const { data: recentUsers } = await supabase
    .from('users')
    .select('created_at')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  const { data: recentRelationships } = await supabase
    .from('relationships')
    .select('created_at')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  return {
    totalUsers: totalUsers || 0,
    activeUsers: activeUsers || 0,
    verifiedRelationships: verifiedRelationships || 0,
    pendingRelationships: pendingRelationships || 0,
    activeDisputes: activeDisputes || 0,
    reportedContent: reportedContent || 0,
    cheatingAlerts: cheatingAlerts || 0,
    newUsersThisWeek: recentUsers?.length || 0,
    newRelationshipsThisWeek: recentRelationships?.length || 0,
  };
});
