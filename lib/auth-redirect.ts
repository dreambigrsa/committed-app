/**
 * Auth redirect URLs for email verification, password reset, etc.
 * Use platform-aware URLs so verification links open the app (native) or web app (web).
 * Set EXPO_PUBLIC_WEB_ORIGIN to your web app URL (e.g. https://yourdomain.com); on web falls back to current origin.
 */

import { Platform } from 'react-native';

const AUTH_CALLBACK_PATH = '/auth-callback';
const DEEP_LINK_SCHEME = 'committed';

function getWebOrigin(): string {
  if (typeof globalThis !== 'undefined' && (globalThis as any).location?.origin)
    return (globalThis as any).location.origin;
  return (process.env.EXPO_PUBLIC_WEB_ORIGIN ?? '').trim() || 'https://committed.app';
}

/**
 * Returns the auth callback URL for the current platform.
 * - Native: committed://localhost/auth-callback
 * - Web: current origin or EXPO_PUBLIC_WEB_ORIGIN + /auth-callback
 *
 * Must match Supabase Redirect URLs whitelist.
 */
export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return `${getWebOrigin()}${AUTH_CALLBACK_PATH}`;
  }
  return `${DEEP_LINK_SCHEME}://localhost${AUTH_CALLBACK_PATH}`;
}
