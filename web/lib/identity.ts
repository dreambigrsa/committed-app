export function getDisplayName(user?: { full_name?: string | null; username?: string | null; email?: string | null } | null) {
  if (!user) return '';
  const email = (user.email || '').trim().toLowerCase();
  const un = (user.username || '').trim();
  const fn = (user.full_name || '').trim();
  /** Web merge used to put @handle into `full_name`; never treat that as a real display name. */
  const duplicateHandleAsName = !!(un && fn && fn === un);
  const fnEffective = duplicateHandleAsName ? '' : fn;
  if (fnEffective) {
    const fnLower = fnEffective.toLowerCase();
    if (email && fnLower === email) {
      // DB was populated with email as full_name — treat as unset (match mobile profile UX).
    } else if (!fnEffective.includes('@')) {
      return fnEffective;
    } else if (!email || fnLower !== email) {
      return fnEffective;
    }
  }
  if (user.username?.trim() && !duplicateHandleAsName) return user.username.trim();
  if (user.email?.includes('@')) return user.email.split('@')[0] || '';
  return (user.email || '').trim() || '';
}
