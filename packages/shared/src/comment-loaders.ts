import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_POST_USER_SELECT } from './feed-constants';

export async function fetchPostCommentsAndLikes(
  client: SupabaseClient,
  postIds: string[]
): Promise<{
  commentsData: Record<string, unknown>[];
  commentLikesData: { comment_id: string; user_id: string }[];
}> {
  if (!postIds.length) {
    return { commentsData: [], commentLikesData: [] };
  }
  const { data: commentsData } = await client
    .from('comments')
    .select(
      `
      *,
      users!comments_user_id_fkey(${APP_POST_USER_SELECT}),
      stickers!comments_sticker_id_fkey(image_url, is_animated)
    `
    )
    .in('post_id', postIds)
    .order('created_at', { ascending: true });

  const rows = (commentsData || []) as Record<string, unknown>[];
  const commentIds = rows.map((c) => c.id as string);
  const { data: commentLikesData } =
    commentIds.length > 0
      ? await client.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
      : { data: [] as { comment_id: string; user_id: string }[] };

  return {
    commentsData: rows,
    commentLikesData: (commentLikesData || []) as { comment_id: string; user_id: string }[],
  };
}

export async function fetchReelCommentsAndLikes(
  client: SupabaseClient,
  reelIds: string[]
): Promise<{
  commentsData: Record<string, unknown>[];
  commentLikesData: { comment_id: string; user_id: string }[];
}> {
  if (!reelIds.length) {
    return { commentsData: [], commentLikesData: [] };
  }
  const { data: commentsData } = await client
    .from('reel_comments')
    .select(
      `
      *,
      users!reel_comments_user_id_fkey(${APP_POST_USER_SELECT}),
      stickers!reel_comments_sticker_id_fkey(image_url, is_animated)
    `
    )
    .in('reel_id', reelIds)
    .order('created_at', { ascending: true });

  const rows = (commentsData || []) as Record<string, unknown>[];
  const commentIds = rows.map((c) => c.id as string);
  const { data: commentLikesData } =
    commentIds.length > 0
      ? await client
          .from('reel_comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', commentIds)
      : { data: [] as { comment_id: string; user_id: string }[] };

  return {
    commentsData: rows,
    commentLikesData: (commentLikesData || []) as { comment_id: string; user_id: string }[],
  };
}
