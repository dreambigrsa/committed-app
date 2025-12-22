import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getLikesReceivedProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Get users who liked this user (premium feature)
    const { data: likes, error } = await supabase
      .from('dating_likes')
      .select(`
        *,
        liker:users!dating_likes_liker_id_fkey(
          id,
          full_name,
          profile_picture,
          phone_verified,
          email_verified,
          id_verified
        )
      `)
      .eq('liked_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting likes received:', error);
      throw new Error('Failed to get likes received');
    }

    // Get user's dating profile photos
    const likesWithPhotos = await Promise.all(
      (likes || []).map(async (like: any) => {
        const { data: profile } = await supabase
          .from('dating_profiles')
          .select('*')
          .eq('user_id', like.liker_id)
          .single();

        let primaryPhoto = like.liker?.profile_picture;
        if (profile) {
          const { data: photo } = await supabase
            .from('dating_photos')
            .select('photo_url')
            .eq('dating_profile_id', profile.id)
            .eq('is_primary', true)
            .single();

          if (photo) {
            primaryPhoto = photo.photo_url;
          } else {
            const { data: firstPhoto } = await supabase
              .from('dating_photos')
              .select('photo_url')
              .eq('dating_profile_id', profile.id)
              .order('display_order', { ascending: true })
              .limit(1)
              .single();

            if (firstPhoto) {
              primaryPhoto = firstPhoto.photo_url;
            }
          }
        }

        return {
          ...like,
          primaryPhoto,
          profile,
        };
      })
    );

    return likesWithPhotos;
  });

