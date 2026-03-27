import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const getMatchesProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Get all matches for this user
    const { data: matches, error } = await supabase
      .from('dating_matches')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq('is_unmatched', false)
      .order('matched_at', { ascending: false });

    if (error) throw error;

    // Get user details for each match
    const matchesWithUsers = await Promise.all(
      (matches || []).map(async (match) => {
        const matchedUserId = match.user1_id === userId ? match.user2_id : match.user1_id;

        // Get user info
        const { data: user } = await supabase
          .from('users')
          .select('id, full_name, profile_picture, phone_verified, email_verified, id_verified')
          .eq('id', matchedUserId)
          .single();

        // Get dating profile
        const { data: profile } = await supabase
          .from('dating_profiles')
          .select('*')
          .eq('user_id', matchedUserId)
          .single();

        // Get primary photo
        let primaryPhoto = null;
        if (profile) {
          const { data: photo } = await supabase
            .from('dating_photos')
            .select('*')
            .eq('dating_profile_id', profile.id)
            .eq('is_primary', true)
            .single();

          if (!photo) {
            const { data: firstPhoto } = await supabase
              .from('dating_photos')
              .select('*')
              .eq('dating_profile_id', profile.id)
              .order('display_order', { ascending: true })
              .limit(1)
              .single();

            primaryPhoto = firstPhoto;
          } else {
            primaryPhoto = photo;
          }
        }

        return {
          ...match,
          matchedUser: user,
          matchedUserProfile: profile,
          primaryPhoto: primaryPhoto?.photo_url || user?.profile_picture,
        };
      })
    );

    return matchesWithUsers;
  });

