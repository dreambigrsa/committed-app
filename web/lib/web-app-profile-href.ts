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

/**
 * Profile navigation for mixed public + signed-in web: signed-in users go to the in-app shell
 * (`/app/profile/...`); guests go to the public profile mirror (`/profile/...`) so they are not
 * forced through sign-in. Prefer `subjectUsername` for cleaner public URLs when available.
 */
export function profileBrowseHref(
  viewerUserId: string | null | undefined,
  subjectUserId: string | null | undefined,
  subjectUsername?: string | null
): string | null {
  const sid = (subjectUserId || '').trim();
  if (!sid) return null;
  const vid = (viewerUserId || '').trim();
  if (vid && sid === vid) return '/app/profile';
  if (vid) return `/app/profile/${encodeURIComponent(sid)}`;
  const uname = (subjectUsername || '').trim().replace(/^@/, '');
  if (uname) return `/profile/${encodeURIComponent(uname)}`;
  return `/profile/${encodeURIComponent(sid)}`;
}
