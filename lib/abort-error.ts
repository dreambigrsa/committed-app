/**
 * Detect Supabase/auth "signal is aborted" style errors that escape promise chains.
 * Used to avoid showing red box / alerts for these non-actionable errors.
 */
export function isAbortLikeError(e: unknown): boolean {
  const msg =
    (e && typeof e === 'object' && 'message' in e ? (e as Error).message : String(e)) ?? '';
  if (typeof msg !== 'string') return false;
  return (
    msg.includes('aborted') ||
    msg.includes('signal is aborted') ||
    msg.includes('without reason')
  );
}
