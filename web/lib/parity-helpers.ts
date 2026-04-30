type MessageLike = {
  sender_id?: string | null;
  receiver_id?: string | null;
  deleted_for_sender?: boolean | null;
  deleted_for_receiver?: boolean | null;
};

type UserScopedLike = {
  user_id?: string | null;
};

export function filterVisibleMessagesForUser<T extends MessageLike>(messages: T[], userId?: string | null) {
  if (!userId) return messages;
  return messages.filter((item) => {
    if (item.sender_id === userId && item.deleted_for_sender) return false;
    if (item.receiver_id === userId && item.deleted_for_receiver) return false;
    return true;
  });
}

export function excludeDatingProfilesForUser<T extends UserScopedLike>(rows: T[], hiddenUserIds: Set<string>) {
  return rows.filter((item) => !!item.user_id && !hiddenUserIds.has(item.user_id));
}
