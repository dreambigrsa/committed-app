import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const createAnniversaryProcedure = protectedProcedure
  .input(
    z.object({
      relationshipId: z.string(),
      anniversaryDate: z.string(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { relationshipId, anniversaryDate } = input;
    const userId = ctx.user.id;

    const { data: relationship } = await supabase
      .from('relationships')
      .select('*')
      .eq('id', relationshipId)
      .single();

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    if (
      relationship.user_id !== userId &&
      relationship.partner_user_id !== userId
    ) {
      throw new Error('Not authorized');
    }

    const { data: anniversary, error } = await supabase
      .from('anniversaries')
      .insert({
        relationship_id: relationshipId,
        anniversary_date: anniversaryDate,
        reminder_sent: false,
      })
      .select()
      .single();

    if (error) throw error;

    return anniversary;
  });
