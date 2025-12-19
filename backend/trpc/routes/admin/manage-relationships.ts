import { z } from 'zod';
import { adminProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getAllRelationshipsProcedure = adminProcedure
  .input(
    z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
      status: z.enum(['pending', 'verified', 'ended']).optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { limit, offset, status } = input;

    let query = supabase
      .from('relationships')
      .select(
        `
        *,
        user:users!relationships_user_id_fkey(full_name, email),
        partner:users!relationships_partner_user_id_fkey(full_name, email)
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
      relationships: data || [],
      total: count || 0,
    };
  });

export const updateRelationshipProcedure = adminProcedure
  .input(
    z.object({
      relationshipId: z.string(),
      status: z.enum(['pending', 'verified', 'ended']).optional(),
      privacyLevel: z
        .enum(['public', 'private', 'verified-only'])
        .optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { relationshipId, status, privacyLevel } = input;

    const updates: any = {};
    if (status) updates.status = status;
    if (privacyLevel) updates.privacy_level = privacyLevel;

    const { data, error } = await supabase
      .from('relationships')
      .update(updates)
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) throw error;

    return data;
  });

export const deleteRelationshipProcedure = adminProcedure
  .input(
    z.object({
      relationshipId: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { relationshipId } = input;

    const { error } = await supabase
      .from('relationships')
      .delete()
      .eq('id', relationshipId);

    if (error) throw error;

    return { success: true };
  });
