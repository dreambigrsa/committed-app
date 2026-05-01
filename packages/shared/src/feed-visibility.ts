const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Post feed OR filter — must match `AppContext` `loadUserData`:
 * `moderation_status.eq.approved,user_id.eq.${userId}`
 */
export function getFeedPostVisibilityOrFilter(userId?: string | null): string {
  const uid = userId && userId.length > 0 ? userId : ZERO_UUID;
  return `moderation_status.eq.approved,user_id.eq.${uid}`;
}

/**
 * Reel feed primary OR filter — match `AppContext` first query path:
 * `status.eq.approved,user_id.eq.${userId}`
 */
export function getFeedReelVisibilityOrFilter(userId?: string | null): string {
  const uid = userId && userId.length > 0 ? userId : ZERO_UUID;
  return `status.eq.approved,user_id.eq.${uid}`;
}
