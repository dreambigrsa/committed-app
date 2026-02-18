/**
 * Auth session utilities: detect invalid refresh token and standardize handling.
 * Used by AppContext for safe hydration and clearSession flow.
 */

export type AuthErrorLike = { message?: string; name?: string; status?: number };

/**
 * Returns true if the error indicates an invalid or missing refresh token.
 * Do not retry refresh when this is true; clear session and redirect to landing.
 */
export function isInvalidRefreshTokenError(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  const name = (error.name ?? '').toLowerCase();
  if (msg.includes('invalid refresh token') || msg.includes('refresh token not found')) return true;
  if (msg.includes('refresh_token') && (msg.includes('invalid') || msg.includes('not found'))) return true;
  if (name.includes('authapierror') && msg.includes('refresh')) return true;
  return false;
}
