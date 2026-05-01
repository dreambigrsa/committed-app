type MessageVisibilityLike = {
  sender_id?: string | null;
  receiver_id?: string | null;
  deleted_for_sender?: boolean | null;
  deleted_for_receiver?: boolean | null;
};

export function isMessageDeletedForUser(
  message: MessageVisibilityLike,
  userId?: string | null
): boolean {
  if (!userId) return false;
  return Boolean(
    (message.sender_id === userId && message.deleted_for_sender) ||
      (message.receiver_id === userId && message.deleted_for_receiver)
  );
}

export function filterVisibleMessagesForUser<T extends MessageVisibilityLike>(
  messages: T[],
  userId?: string | null
): T[] {
  if (!userId) return messages;
  return messages.filter((item) => !isMessageDeletedForUser(item, userId));
}
