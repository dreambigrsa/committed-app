/**
 * Realtime channels for `posts`, `reels`, and `relationships` — same shape as
 * `AppContext.setupRealtimeSubscriptions` (feed + relationship refresh).
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type PostgresChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

function normalizePayload(payload: {
  eventType: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}): PostgresChangePayload {
  return {
    eventType: payload.eventType as PostgresChangePayload['eventType'],
    new: payload.new ?? null,
    old: payload.old ?? null,
  };
}

export type MirrorFeedRelationshipCallbacks = {
  shouldIgnore?: () => boolean;
  onPostsChange: (payload: PostgresChangePayload) => void | Promise<void>;
  onReelsChange: (payload: PostgresChangePayload) => void | Promise<void>;
  /** Called when `relationships` rows involving this user may have changed. */
  onRelationshipsChange: () => void | Promise<void>;
};

/**
 * Subscribes to posts and reels (`event: *`) and relationships (user or partner = userId).
 */
export function subscribeMirrorFeedRelationshipRealtime(
  client: SupabaseClient,
  userId: string,
  cb: MirrorFeedRelationshipCallbacks
): () => void {
  const shouldIgnore = cb.shouldIgnore ?? (() => false);
  const channels: RealtimeChannel[] = [];

  const postsChannel = client
    .channel(`mirror_feed_posts_${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'posts' },
      (payload) => {
        if (shouldIgnore()) return;
        void cb.onPostsChange(normalizePayload(payload as any));
      }
    )
    .subscribe();
  channels.push(postsChannel);

  const reelsChannel = client
    .channel(`mirror_feed_reels_${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reels' },
      (payload) => {
        if (shouldIgnore()) return;
        void cb.onReelsChange(normalizePayload(payload as any));
      }
    )
    .subscribe();
  channels.push(reelsChannel);

  const relationshipsChannel = client
    .channel(`mirror_feed_relationships_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'relationships',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        if (shouldIgnore()) return;
        void cb.onRelationshipsChange();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'relationships',
        filter: `partner_user_id=eq.${userId}`,
      },
      () => {
        if (shouldIgnore()) return;
        void cb.onRelationshipsChange();
      }
    )
    .subscribe();
  channels.push(relationshipsChannel);

  return () => {
    for (const ch of channels) {
      try {
        client.removeChannel(ch);
      } catch {
        /* best-effort */
      }
    }
  };
}
