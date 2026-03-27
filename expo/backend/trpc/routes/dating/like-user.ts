import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';

export const likeUserProcedure = protectedProcedure
  .input(
    z.object({
      likedUserId: z.string().uuid(),
      isSuperLike: z.boolean().default(false),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;
    const { likedUserId, isSuperLike } = input;

    if (userId === likedUserId) {
      throw new Error('Cannot like yourself');
    }

    // Check feature limit for free users
    if (!isSuperLike) {
      const { data: canLike } = await supabase.rpc('check_dating_feature_limit', {
        user_id_param: userId,
        feature_name_param: 'daily_likes',
      });
      
      if (!canLike) {
        throw new Error('Daily like limit reached. Upgrade to Premium for unlimited likes!');
      }
    } else {
      const { data: canSuperLike } = await supabase.rpc('check_dating_feature_limit', {
        user_id_param: userId,
        feature_name_param: 'daily_super_likes',
      });
      
      if (!canSuperLike) {
        throw new Error('Daily super like limit reached. Upgrade to Premium for unlimited super likes!');
      }
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('dating_likes')
      .select('id')
      .eq('liker_id', userId)
      .eq('liked_id', likedUserId)
      .single();

    if (existingLike) {
      // Update to super like if needed
      if (isSuperLike) {
        const { data, error } = await supabase
          .from('dating_likes')
          .update({ is_super_like: true })
          .eq('id', existingLike.id)
          .select()
          .single();

        if (error) throw error;
        return { like: data, isMatch: false };
      }
      return { like: existingLike, isMatch: false };
    }

    // Create like
    const { data: like, error: likeError } = await supabase
      .from('dating_likes')
      .insert({
        liker_id: userId,
        liked_id: likedUserId,
        is_super_like: isSuperLike,
      })
      .select()
      .single();

    if (likeError) throw likeError;

    // Track usage
    await supabase.rpc('track_dating_usage', {
      user_id_param: userId,
      feature_name_param: isSuperLike ? 'daily_super_likes' : 'daily_likes',
      increment_by: 1,
    });

    // Check for mutual match (trigger will handle this, but we check here too)
    const { data: mutualLike } = await supabase
      .from('dating_likes')
      .select('id')
      .eq('liker_id', likedUserId)
      .eq('liked_id', userId)
      .single();

    const isMatch = !!mutualLike;

    // Create notification for the liked user (if not a match yet)
    if (!isMatch) {
      await supabase.from('notifications').insert({
        user_id: likedUserId,
        type: isSuperLike ? 'dating_super_like' : 'dating_like',
        title: isSuperLike ? 'Super Like!' : 'Someone Liked You',
        message: isSuperLike 
          ? 'Someone super liked you! Check your matches.' 
          : 'Someone liked your profile. Like them back to match!',
        data: { liker_id: userId },
        read: false,
      });
    }

    return { like, isMatch };
  });

