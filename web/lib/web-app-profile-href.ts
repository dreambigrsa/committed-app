/**
 * In-app shell profile URL for a **member profile** (stats, posts grid, etc.).
 * Always `/app/profile/{userId}` — including when viewing yourself — so taps on your
 * own name in feed/reels match “view profile” UX. The profile **hub** (settings list)
 * stays at `/app/profile` via bottom nav only, not via user links.
 */
export function webAppProfileHref(
  _viewerUserId: string | null | undefined,
  subjectUserId: string | null | undefined
): string | null {
  const sid = (subjectUserId || '').trim();
  if (!sid) return null;
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
  if (vid) return `/app/profile/${encodeURIComponent(sid)}`;
  const uname = (subjectUsername || '').trim().replace(/^@/, '');
  if (uname) return `/profile/${encodeURIComponent(uname)}`;
  return `/profile/${encodeURIComponent(sid)}`;
}
