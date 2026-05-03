/**
 * In-app shell profile URL: own account → main profile tab; other users → `/app/profile/{userId}`.
 * Used by web mirror UI so avatars and names navigate like the native app.
 */
export function webAppProfileHref(
  viewerUserId: string | null | undefined,
  subjectUserId: string | null | undefined
): string | null {
  const sid = (subjectUserId || '').trim();
  if (!sid) return null;
  const vid = (viewerUserId || '').trim();
  if (vid && sid === vid) return '/app/profile';
  return `/app/profile/${encodeURIComponent(sid)}`;
}
