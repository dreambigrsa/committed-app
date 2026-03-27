import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const unmatchProcedure = protectedProcedure
  .input(
    z.object({
      matchId: z.string().uuid(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;
    const { matchId } = input;

    // Get match
    const { data: match, error: matchError } = await supabase
      .from('dating_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError) throw matchError;

    if (match.user1_id !== userId && match.user2_id !== userId) {
      throw new Error('Not authorized to unmatch');
    }

    // Update match
    const { data: updatedMatch, error } = await supabase
      .from('dating_matches')
      .update({
        is_unmatched: true,
        unmatched_at: new Date().toISOString(),
        unmatched_by: userId,
      })
      .eq('id', matchId)
      .select()
      .single();

    if (error) throw error;

    // Notify the other user
    const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;
    await supabase.from('notifications').insert({
      user_id: otherUserId,
      type: 'message',
      title: 'Match Ended',
      message: 'Someone unmatched with you',
      data: { match_id: matchId },
      read: false,
    });

    return updatedMatch;
  });

