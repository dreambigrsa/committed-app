import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const endRelationshipProcedure = protectedProcedure
  .input(
    z.object({
      relationshipId: z.string(),
      reason: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const { relationshipId, reason } = input;
    const userId = ctx.user.id;

    const { data: relationship } = await supabase
      .from('relationships')
      .select('*')
      .eq('id', relationshipId)
      .single();

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    const autoResolveDate = new Date();
    autoResolveDate.setDate(autoResolveDate.getDate() + 7);

    const { data: dispute, error } = await supabase
      .from('disputes')
      .insert({
        relationship_id: relationshipId,
        initiated_by: userId,
        dispute_type: 'end_relationship',
        description: reason || 'Request to end relationship',
        status: 'pending',
        auto_resolve_at: autoResolveDate.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    const partnerId =
      relationship.user_id === userId
        ? relationship.partner_user_id
        : relationship.user_id;

    if (partnerId) {
      await supabase.from('notifications').insert({
        user_id: partnerId,
        type: 'relationship_end_request',
        title: 'End Relationship Request',
        message: `Your partner has requested to end your relationship. Please confirm or it will auto-resolve in 7 days.`,
        data: { relationshipId, disputeId: dispute.id },
        read: false,
      });
    }

    return dispute;
  });
