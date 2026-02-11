/**
 * Auth redirect URLs for email verification, password reset, etc.
 * Use platform-aware URLs so verification links open the app (native) or web app (web).
 */

import { Platform } from 'react-native';

const WEB_ORIGIN = 'https://committed-5mxf.onrender.com';
const AUTH_CALLBACK_PATH = '/auth-callback';
const DEEP_LINK_SCHEME = 'committed';

/**
 * Returns the auth callback URL for the current platform.
 * - Native: committed://localhost/auth-callback — use localhost as host so
 *   Expo Router parses path as /auth-callback (not as host, which would route to /)
 * - Web: https://committed-5mxf.onrender.com/auth-callback — stays in browser
 *
 * Must match Supabase Redirect URLs whitelist.
 */
export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return `${WEB_ORIGIN}${AUTH_CALLBACK_PATH}`;
  }
  return `${DEEP_LINK_SCHEME}://localhost${AUTH_CALLBACK_PATH}`;
}
