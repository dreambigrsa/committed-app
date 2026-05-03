/**
 * Normalize PostgREST `count` from supabase-js (`select(..., { count: 'exact' })`).
 * Some responses return string counts or omit `count` when paired with errors.
 */
export function parseSupabaseCount(
  res: { count?: number | null; error?: { message?: string } | null } | null | undefined
): number {
  if (!res || res.error) {
    if (res?.error && process.env.NODE_ENV !== 'production') {
      console.warn('[parseSupabaseCount]', res.error.message);
    }
    return 0;
  }
  const c = res.count as unknown;
  if (typeof c === 'number' && !Number.isNaN(c)) return c;
  if (typeof c === 'string' && c.trim() !== '') {
    const n = Number(c);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}
