import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const uploadDatingVideoProcedure = protectedProcedure
  .input(
    z.object({
      videoUrl: z.string().url(),
      thumbnailUrl: z.string().url().optional(),
      durationSeconds: z.number().optional(),
      displayOrder: z.number().default(0),
      isPrimary: z.boolean().default(false),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Get user's dating profile
    const { data: profile, error: profileError } = await supabase
      .from('dating_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Dating profile not found. Please create a profile first.');
    }

    // If setting as primary, unset other primary videos
    if (input.isPrimary) {
      await supabase
        .from('dating_videos')
        .update({ is_primary: false })
        .eq('dating_profile_id', profile.id);
    }

    // Insert new video
    const { data: video, error } = await supabase
      .from('dating_videos')
      .insert({
        dating_profile_id: profile.id,
        video_url: input.videoUrl,
        thumbnail_url: input.thumbnailUrl,
        duration_seconds: input.durationSeconds,
        display_order: input.displayOrder,
        is_primary: input.isPrimary,
      })
      .select()
      .single();

    if (error) throw error;

    return video;
  });

