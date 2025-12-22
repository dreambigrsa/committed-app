import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const deleteDatingPhotoProcedure = protectedProcedure
  .input(
    z.object({
      photoId: z.string().uuid(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;
    const { photoId } = input;

    // Verify photo belongs to user's profile
    const { data: photo, error: photoError } = await supabase
      .from('dating_photos')
      .select('dating_profile_id, dating_profiles!inner(user_id)')
      .eq('id', photoId)
      .single();

    if (photoError || !photo) {
      throw new Error('Photo not found');
    }

    // Delete photo
    const { error } = await supabase
      .from('dating_photos')
      .delete()
      .eq('id', photoId);

    if (error) throw error;

    return { success: true };
  });

