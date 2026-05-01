/**
 * Supabase Realtime wiring aligned with `AppContext.setupRealtimeSubscriptions`
 * for messages, conversations, and notifications — shared by web shell (Expo keeps
 * its inline channels until refactored).
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { isMessageDeletedForUser } from './message-visibility';

export type MirrorCoreRealtimeCallbacks = {
  shouldIgnore?: () => boolean;
  onIncomingMessage: (row: Record<string, unknown>) => void;
  onMessageUpdated: (row: Record<string, unknown>) => void;
  onMessageRemovedFromThread: (conversationId: string, messageId: string) => void;
  onConversationUpdated: (row: Record<string, unknown>) => void;
  onConversationDeleted: (conversationId: string) => void;
  onNotificationInserted: (row: Record<string, unknown>) => void;
};

/**
 * Subscribes to the same core tables/filters as the mobile app's realtime bootstrap.
 * Returns an unsubscribe function that removes all channels.
 */
export function subscribeMirrorCoreRealtime(
  client: SupabaseClient,
  userId: string,
  cb: MirrorCoreRealtimeCallbacks
): () => void {
  const shouldIgnore = cb.shouldIgnore ?? (() => false);
  const channels: RealtimeChannel[] = [];

  const messagesChannel = client
    .channel(`mirror_core_messages_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      },
      (payload) => {
        if (shouldIgnore()) return;
        const row = payload.new as Record<string, unknown>;
        if (isMessageDeletedForUser(row, userId)) return;
        cb.onIncomingMessage(row);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        if (shouldIgnore()) return;
        const row = payload.new as Record<string, unknown>;
        if (isMessageDeletedForUser(row, userId)) {
          cb.onMessageRemovedFromThread(String(row.conversation_id), String(row.id));
          return;
        }
        cb.onMessageUpdated(row);
      }
    )
    .subscribe();
  channels.push(messagesChannel);

  const conversationsChannel = client
    .channel(`mirror_core_conversations_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
      },
      (payload) => {
        if (shouldIgnore()) return;
        const row = payload.new as Record<string, unknown>;
        const pids = row.participant_ids as string[] | undefined;
        if (!pids?.includes(userId)) return;
        cb.onConversationUpdated(row);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'conversations',
      },
      (payload) => {
        if (shouldIgnore()) return;
        const oldRow = payload.old as { id?: string };
        if (oldRow?.id) cb.onConversationDeleted(oldRow.id);
      }
    )
    .subscribe();
  channels.push(conversationsChannel);

  const notificationsChannel = client
    .channel(`mirror_core_notifications_${userId}_${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      },
      (payload) => {
        if (shouldIgnore()) return;
        const row = payload.new as Record<string, unknown>;
        if (row.user_id !== userId) return;
        cb.onNotificationInserted(row);
      }
    )
    .subscribe();
  channels.push(notificationsChannel);

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
