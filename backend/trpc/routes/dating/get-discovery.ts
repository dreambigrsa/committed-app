import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getDiscoveryProcedure = protectedProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(50).default(20),
    })
  )
  .query(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;
    const { limit } = input;

    // Call the database function to get discovery feed
    const { data, error } = await supabase.rpc('get_dating_discovery', {
      current_user_id: userId,
      limit_count: limit,
    });

    if (error) {
      console.error('Error getting discovery:', error);
      throw new Error('Failed to get discovery feed');
    }

    return data || [];
  });

