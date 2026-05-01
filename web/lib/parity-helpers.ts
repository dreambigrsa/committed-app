import { filterVisibleMessagesForUser } from '@committed/shared';

type UserScopedLike = {
  user_id?: string | null;
};

export function excludeDatingProfilesForUser<T extends UserScopedLike>(rows: T[], hiddenUserIds: Set<string>) {
  return rows.filter((item) => !!item.user_id && !hiddenUserIds.has(item.user_id));
}

export { filterVisibleMessagesForUser };
