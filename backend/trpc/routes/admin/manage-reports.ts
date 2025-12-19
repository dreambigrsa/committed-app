import { z } from 'zod';
import { adminProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getReportedContentProcedure = adminProcedure
  .input(
    z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
      status: z
        .enum(['pending', 'reviewing', 'resolved', 'dismissed'])
        .optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { limit, offset, status } = input;

    let query = supabase
      .from('reported_content')
      .select(
        `
        *,
        reporter:users!reported_content_reporter_id_fkey(full_name, email),
        reported_user:users!reported_content_reported_user_id_fkey(full_name, email)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      reports: data || [],
      total: count || 0,
    };
  });

export const reviewReportProcedure = adminProcedure
  .input(
    z.object({
      reportId: z.string(),
      status: z.enum(['reviewing', 'resolved', 'dismissed']),
      actionTaken: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { reportId, status, actionTaken } = input;
    const adminId = ctx.user.id;

    const { data, error } = await supabase
      .from('reported_content')
      .update({
        status,
        action_taken: actionTaken,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;

    return data;
  });
