/**
 * Conversation + message bootstrap — same flow as `AppContext.loadUserData`.
 * Returns raw rows; app maps to `Message` / `Conversation` types.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_CONVERSATIONS_LIST_LIMIT } from './bootstrap-constants';
import { APP_USER_IDENTITY_SELECT } from './user-identity-select';

export type RawMessageRow = Record<string, unknown> & {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content?: string | null;
  media_url?: string | null;
  document_url?: string | null;
  document_name?: string | null;
  message_type?: string | null;
  deleted_for_sender?: boolean | null;
  deleted_for_receiver?: boolean | null;
  read?: boolean | null;
  created_at: string;
  status_id?: string | null;
  status_preview_url?: string | null;
};

export type ConversationBootstrapResult = {
  /** Raw conversation rows from DB (deduplicated by participant set). */
  deduplicatedConversations: Record<string, unknown>[];
  /** Message rows per conversation id (chronological), excluding deleted-for-user. */
  messagesByConversation: Record<string, RawMessageRow[]>;
  /** `users` rows for all participants. */
  participantUsers: Record<string, unknown>[];
};

/**
 * When user has no conversations, returns empty structures (not null) for simpler callers.
 */
export async function fetchConversationsBootstrap(
  client: SupabaseClient,
  userId: string
): Promise<ConversationBootstrapResult> {
  const empty: ConversationBootstrapResult = {
    deduplicatedConversations: [],
    messagesByConversation: {},
    participantUsers: [],
  };

  const { data: conversationsData } = await client
    .from('conversations')
    .select(
      `
          *,
          participant_users:participant_ids
        `
    )
    .contains('participant_ids', [userId])
    .order('last_message_at', { ascending: false })
    .limit(APP_CONVERSATIONS_LIST_LIMIT);

  if (!conversationsData?.length) {
    return empty;
  }

  const conversationIds = (conversationsData as { id: string }[]).map((c) => c.id);
  const { data: messagesData } = await client
    .from('messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(Math.min(conversationIds.length * 50, 500));

  const sortedMessages = messagesData ? [...messagesData].reverse() : [];

  const messagesByConversation: Record<string, RawMessageRow[]> = {};
  for (const m of sortedMessages as RawMessageRow[]) {
    const isSender = m.sender_id === userId;
    const isReceiver = m.receiver_id === userId;
    const deletedForMe =
      (isSender && m.deleted_for_sender) || (isReceiver && m.deleted_for_receiver);
    if (deletedForMe) continue;

    const cid = m.conversation_id;
    if (!messagesByConversation[cid]) messagesByConversation[cid] = [];
    messagesByConversation[cid].push(m);
  }

  const conversationMap = new Map<string, Record<string, unknown>>();
  for (const conv of conversationsData as Record<string, unknown>[]) {
    const participants = (conv.participant_ids as string[]) || [];
    const key = [...participants].sort().join(',');
    const existing = conversationMap.get(key);
    const convLast = new Date(
      (conv.last_message_at as string) || (conv.created_at as string) || 0
    ).getTime();
    const existingLast = existing
      ? new Date(
          (existing.last_message_at as string) || (existing.created_at as string) || 0
        ).getTime()
      : 0;
    if (!existing || convLast > existingLast) {
      conversationMap.set(key, conv);
    }
  }
  const deduplicatedConversations = Array.from(conversationMap.values());

  const allParticipantIds = Array.from(
    new Set(
      deduplicatedConversations.flatMap((conv) => (conv.participant_ids as string[]) || [])
    )
  );

  const { data: allParticipantsData } =
    allParticipantIds.length > 0
      ? await client.from('users').select(APP_USER_IDENTITY_SELECT).in('id', allParticipantIds)
      : { data: [] as Record<string, unknown>[] };

  return {
    deduplicatedConversations,
    messagesByConversation,
    participantUsers: (allParticipantsData || []) as Record<string, unknown>[],
  };
}
