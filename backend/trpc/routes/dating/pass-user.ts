import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const passUserProcedure = protectedProcedure
  .input(
    z.object({
      passedUserId: z.string().uuid(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;
    const { passedUserId } = input;

    if (userId === passedUserId) {
      throw new Error('Cannot pass yourself');
    }

    // Check if already passed
    const { data: existingPass } = await supabase
      .from('dating_passes')
      .select('id')
      .eq('passer_id', userId)
      .eq('passed_id', passedUserId)
      .single();

    if (existingPass) {
      return { success: true, alreadyPassed: true };
    }

    // Create pass
    const { data: pass, error } = await supabase
      .from('dating_passes')
      .insert({
        passer_id: userId,
        passed_id: passedUserId,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, pass };
  });

