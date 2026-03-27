/**
 * Auth redirect URLs for email verification and password recovery.
 * Must match Supabase URL Configuration (Site URL + Redirect URLs allow list).
 * Native: committed://auth-callback (no localhost). Web: current origin /auth-callback.
 */

import { Platform } from 'react-native';

const AUTH_CALLBACK_PATH = '/auth-callback';
const DEEP_LINK_SCHEME = 'committed';

function getWebOrigin(): string {
  if (typeof globalThis !== 'undefined' && (globalThis as any).location?.origin)
    return (globalThis as any).location.origin;
  return (process.env.EXPO_PUBLIC_WEB_ORIGIN ?? '').trim() || 'https://committed.dreambig.org.za';
}

/**
 * Returns the auth callback URL for the current platform.
 * - Web: ${origin}/auth-callback (plus ?type=recovery if intent === 'recovery')
 * - Native: committed://auth-callback (no localhost; matches Supabase Site URL)
 */
export function getAuthRedirectUrl(intent?: 'verify' | 'recovery'): string {
  if (Platform.OS === 'web') {
    const base = `${getWebOrigin()}${AUTH_CALLBACK_PATH}`;
    return intent === 'recovery' ? `${base}?type=recovery` : base;
  }
  const base = `${DEEP_LINK_SCHEME}://auth-callback`;
  return intent === 'recovery' ? `${base}?type=recovery` : base;
}

/** @deprecated Use getAuthRedirectUrl() instead */
export function getAuthRedirectUrlForRecovery(): string {
  return getAuthRedirectUrl('recovery');
}
