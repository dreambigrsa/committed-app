/**
 * Feed bootstrap queries — same Supabase chains as `contexts/AppContext.tsx` `loadUserData`.
 * Pass any SupabaseClient (Expo or Next browser) so web and native stay aligned.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_FEED_POSTS_LIMIT, APP_FEED_REELS_LIMIT, APP_POST_USER_SELECT } from './feed-constants';
import { getFeedPostVisibilityOrFilter, getFeedReelVisibilityOrFilter } from './feed-visibility';

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((p) => [p.id, p])).values());
}

export type FeedPostLikeRow = { post_id: string; user_id: string };
export type FeedReelLikeRow = { reel_id: string; user_id: string };

/** Raw post rows from DB (snake_case + joined `users`). */
export type FeedPostDbRow = Record<string, unknown> & {
  id: string;
  user_id: string;
  users?: {
    full_name?: string | null;
    username?: string | null;
    email?: string | null;
    profile_picture?: string | null;
  } | null;
};

/** Raw reel rows from DB. */
export type FeedReelDbRow = Record<string, unknown> & {
  id: string;
  user_id: string;
  users?: FeedPostDbRow['users'];
};

export async function fetchFeedPostsWithLikes(
  client: SupabaseClient,
  userId: string
): Promise<{ posts: FeedPostDbRow[]; likesByPostId: Record<string, string[]> }> {
  const { data: postsData } = await client
    .from('posts')
    .select(
      `
          *,
          users!posts_user_id_fkey(${APP_POST_USER_SELECT})
        `
    )
    .or(getFeedPostVisibilityOrFilter(userId))
    .order('created_at', { ascending: false })
    .limit(APP_FEED_POSTS_LIMIT);

  const uniquePostsData = postsData ? dedupeById(postsData as FeedPostDbRow[]) : [];
  const postIds = uniquePostsData.map((p) => p.id);
  const { data: postLikesData } =
    postIds.length > 0
      ? await client.from('post_likes').select('post_id, user_id').in('post_id', postIds)
      : { data: [] as FeedPostLikeRow[] };

  const likesByPostId: Record<string, string[]> = {};
  (postLikesData || []).forEach((like: FeedPostLikeRow) => {
    if (!likesByPostId[like.post_id]) likesByPostId[like.post_id] = [];
    likesByPostId[like.post_id].push(like.user_id);
  });

  return { posts: uniquePostsData, likesByPostId };
}

export async function fetchFeedReelsWithLikes(
  client: SupabaseClient,
  userId: string
): Promise<{ reels: FeedReelDbRow[]; likesByReelId: Record<string, string[]> }> {
  let { data: reelsData, error: reelsError } = await client
    .from('reels')
    .select(
      `
          *,
          users!reels_user_id_fkey(${APP_POST_USER_SELECT})
        `
    )
    .or(getFeedReelVisibilityOrFilter(userId))
    .order('created_at', { ascending: false })
    .limit(APP_FEED_REELS_LIMIT);

  if (reelsError) {
    const { data: reelsDataModStatus } = await client
      .from('reels')
      .select(
        `
            *,
            users!reels_user_id_fkey(${APP_POST_USER_SELECT})
          `
      )
      .or(getFeedPostVisibilityOrFilter(userId))
      .order('created_at', { ascending: false })
      .limit(APP_FEED_REELS_LIMIT);

    if (reelsDataModStatus) {
      reelsData = reelsDataModStatus;
    } else {
      const { data: allReels } = await client
        .from('reels')
        .select(
          `
              *,
              users!reels_user_id_fkey(${APP_POST_USER_SELECT})
            `
        )
        .order('created_at', { ascending: false })
        .limit(APP_FEED_REELS_LIMIT);
      reelsData = allReels;
    }
  }

  const list = (reelsData || []) as FeedReelDbRow[];
  const reelIds = list.map((r) => r.id);
  const { data: reelLikesData } =
    reelIds.length > 0
      ? await client.from('reel_likes').select('reel_id, user_id').in('reel_id', reelIds)
      : { data: [] as FeedReelLikeRow[] };

  const likesByReelId: Record<string, string[]> = {};
  (reelLikesData || []).forEach((like: FeedReelLikeRow) => {
    if (!likesByReelId[like.reel_id]) likesByReelId[like.reel_id] = [];
    likesByReelId[like.reel_id].push(like.user_id);
  });

  return { reels: list, likesByReelId };
}
