import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const uploadDatingPhotoProcedure = protectedProcedure
  .input(
    z.object({
      photoUrl: z.string().url(),
      displayOrder: z.number().default(0),
      isPrimary: z.boolean().default(false),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;
    const { photoUrl, displayOrder, isPrimary } = input;

    // Get user's dating profile
    const { data: profile, error: profileError } = await supabase
      .from('dating_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Dating profile not found. Please create a profile first.');
    }

    // If setting as primary, unset other primary photos
    if (isPrimary) {
      await supabase
        .from('dating_photos')
        .update({ is_primary: false })
        .eq('dating_profile_id', profile.id);
    }

    // Insert new photo
    const { data: photo, error } = await supabase
      .from('dating_photos')
      .insert({
        dating_profile_id: profile.id,
        photo_url: photoUrl,
        display_order: displayOrder,
        is_primary: isPrimary,
      })
      .select()
      .single();

    if (error) throw error;

    return photo;
  });

