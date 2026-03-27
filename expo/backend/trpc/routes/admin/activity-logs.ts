import { z } from 'zod';
import { adminProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getActivityLogsProcedure = adminProcedure
  .input(
    z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
      userId: z.string().optional(),
      action: z.string().optional(),
      resourceType: z.string().optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { limit, offset, userId, action, resourceType } = input;

    let query = supabase
      .from('activity_logs')
      .select(
        `
        *,
        users!activity_logs_user_id_fkey(full_name, email)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (action) {
      query = query.eq('action', action);
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      logs: data || [],
      total: count || 0,
    };
  });
