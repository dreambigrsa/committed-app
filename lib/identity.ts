type DisplayIdentity = {
  full_name?: string | null;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
};

export function getDisplayName(user?: DisplayIdentity | null) {
  if (!user) return 'Committed member';

  const username = user.username?.trim();
  if (username) return username;

  const fullName = (user.full_name ?? user.fullName ?? '').trim();
  if (fullName && !fullName.includes('@')) return fullName;

  const email = user.email?.trim();
  if (email?.includes('@')) return email.split('@')[0] || 'Committed member';
  if (fullName.includes('@')) return fullName.split('@')[0] || 'Committed member';

  return email || 'Committed member';
}
