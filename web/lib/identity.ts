export function getDisplayName(user?: { full_name?: string | null; username?: string | null; email?: string | null } | null) {
  if (!user) return '';
  const email = (user.email || '').trim().toLowerCase();
  const fn = (user.full_name || '').trim();
  if (fn) {
    const fnLower = fn.toLowerCase();
    if (email && fnLower === email) {
      // DB was populated with email as full_name — treat as unset (match mobile profile UX).
    } else if (!fn.includes('@')) {
      return fn;
    } else if (!email || fnLower !== email) {
      return fn;
    }
  }
  if (user.username?.trim()) return user.username.trim();
  if (user.email?.includes('@')) return user.email.split('@')[0] || '';
  return (user.email || '').trim() || '';
}
