const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

export function getPostVisibilityOrFilter(userId?: string | null) {
  const uid = userId && userId.length > 0 ? userId : ZERO_UUID;
  return `moderation_status.eq.approved,user_id.eq.${uid}`;
}

export function getReelVisibilityOrFilter(userId?: string | null) {
  const uid = userId && userId.length > 0 ? userId : ZERO_UUID;
  return `status.eq.approved,moderation_status.eq.approved,user_id.eq.${uid}`;
}
