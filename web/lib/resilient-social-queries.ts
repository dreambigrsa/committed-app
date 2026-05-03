import { getPostVisibilityOrFilter, getReelVisibilityOrFilter } from '@/lib/content-visibility';

const POST_SELECT_WITH_USERS =
  'id,user_id,content,media_urls,media_type,comment_count,created_at,users!posts_user_id_fkey(full_name,username,profile_picture)';
const REEL_SELECT_WITH_USERS =
  'id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name,username,profile_picture)';

type SupabaseLike = { from: (t: string) => any };

/**
 * Web shell home feed: prefer the same visibility OR as native, but when PostgREST rejects
 * the filter (missing `moderation_status`, etc.) fall back to latest rows — RLS still applies.
 */
export async function fetchBootstrapPostsForWebFeed(
  supabase: SupabaseLike,
  authUserId: string,
  limit: number,
): Promise<{ data: any[]; usedFallback: boolean }> {
  const primary = await supabase
    .from('posts')
    .select(POST_SELECT_WITH_USERS)
    .or(getPostVisibilityOrFilter(authUserId))
    .order('created_at', { ascending: false })
    .limit(limit);
  const rows = (primary.data || []) as any[];
  if (!primary.error && rows.length > 0) {
    return { data: rows, usedFallback: false };
  }
  const fallback = await supabase
    .from('posts')
    .select(POST_SELECT_WITH_USERS)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: ((fallback.data || []) as any[]).filter(Boolean), usedFallback: true };
}

/** Same pattern as `AppContext` reels + a plain list fallback. */
export async function fetchBootstrapReelsForWebFeed(
  supabase: SupabaseLike,
  authUserId: string,
  limit: number,
): Promise<{ data: any[]; usedFallback: boolean }> {
  let { data, error } = await supabase
    .from('reels')
    .select(REEL_SELECT_WITH_USERS)
    .or(getReelVisibilityOrFilter(authUserId))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    const mod = await supabase
      .from('reels')
      .select(REEL_SELECT_WITH_USERS)
      .or(`moderation_status.eq.approved,user_id.eq.${authUserId}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!mod.error && (mod.data || []).length) {
      return { data: mod.data as any[], usedFallback: true };
    }
    const plain = await supabase
      .from('reels')
      .select(REEL_SELECT_WITH_USERS)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: ((plain.data || []) as any[]).filter(Boolean), usedFallback: true };
  }

  const rows = (data || []) as any[];
  if (rows.length > 0) return { data: rows, usedFallback: false };

  const plain = await supabase
    .from('reels')
    .select(REEL_SELECT_WITH_USERS)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: ((plain.data || []) as any[]).filter(Boolean), usedFallback: true };
}
