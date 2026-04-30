export function getDisplayName(user?: { full_name?: string | null; username?: string | null; email?: string | null } | null) {
  if (!user) return 'Committed member';
  if (user.username?.trim()) return user.username.trim();
  if (user.full_name?.trim() && !user.full_name.includes('@')) return user.full_name.trim();
  if (user.email?.includes('@')) return user.email.split('@')[0] || 'Committed member';
  if (user.full_name?.includes('@')) return user.full_name.split('@')[0] || 'Committed member';
  return user.email || 'Committed member';
}
