import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getDateRequestsProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Get all date requests (sent and received)
    const { data: dateRequests, error } = await supabase
      .from('dating_date_requests')
      .select(`
        *,
        from_user:users!dating_date_requests_from_user_id_fkey(id, full_name, profile_picture),
        to_user:users!dating_date_requests_to_user_id_fkey(id, full_name, profile_picture),
        match:dating_matches(id, user1_id, user2_id, matched_at)
      `)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting date requests:', error);
      throw new Error('Failed to get date requests');
    }

    return dateRequests || [];
  });

