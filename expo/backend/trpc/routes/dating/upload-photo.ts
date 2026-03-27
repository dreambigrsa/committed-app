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

    // Get user's dating profile, or create a minimal one if it doesn't exist
    let { data: profile, error: profileError } = await supabase
      .from('dating_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    // If profile doesn't exist, create a minimal one
    if (profileError || !profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('dating_profiles')
        .insert({
          user_id: userId,
          is_active: true,
        })
        .select('id')
        .single();

      if (createError || !newProfile) {
        throw new Error('Failed to create dating profile. Please try again.');
      }

      profile = newProfile;
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

