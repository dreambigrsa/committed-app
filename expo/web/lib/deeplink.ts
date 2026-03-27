/**
 * Deep link helpers for opening the app or falling back to store/web.
 * Use these for all CTA interactions — no direct window.location or href logic in components.
 */

import {
  APP_SCHEME,
  WEB_BASE_URL,
  APP_STORE_URL,
  PLAY_STORE_URL,
  getMobileOS,
  isMobile,
  deepLinks,
  UNIVERSAL_DOWNLOAD_URL,
} from './appLinks';

const DEEP_LINK_FALLBACK_MS = 900;

/** Attempt to open app via deep link, then fallback to url after delay. Used on mobile. */
export function openAppOrStore({
  path,
  fallbackUrl,
  fallbackDelayMs = DEEP_LINK_FALLBACK_MS,
}: {
  path: string;
  fallbackUrl: string;
  fallbackDelayMs?: number;
}): void {
  if (typeof window === 'undefined') return;
  const deepLink = path.startsWith(APP_SCHEME) ? path : `${APP_SCHEME}${path}`;
  window.location.href = deepLink;
  const t = setTimeout(() => {
    window.location.href = fallbackUrl;
  }, fallbackDelayMs);
  // If user leaves (app opens), clearTimeout won't run — that's fine.
  // If page visibility changes (user switched apps), we could clear — keep it simple.
  (window as unknown as { _deeplinkTimeout?: number })._deeplinkTimeout = t as unknown as number;
}

/** Open Download flow: desktop → QR modal (caller shows modal), mobile → deep link then store */
export function openDownload(options?: { onDesktopShowModal?: () => void }): void {
  if (typeof window === 'undefined') return;
  const os = getMobileOS();
  if (os === 'ios' && APP_STORE_URL !== '#') {
    openAppOrStore({ path: APP_SCHEME + 'download', fallbackUrl: APP_STORE_URL });
    return;
  }
  if (os === 'android' && PLAY_STORE_URL !== '#') {
    openAppOrStore({ path: APP_SCHEME + 'download', fallbackUrl: PLAY_STORE_URL });
    return;
  }
  if (options?.onDesktopShowModal) {
    options.onDesktopShowModal();
  } else {
    window.location.href = UNIVERSAL_DOWNLOAD_URL;
  }
}

/** Open Sign Up: mobile → deep link then store, desktop → /sign-up */
export function openSignup(): string {
  if (typeof window === 'undefined') return '/sign-up';
  if (isMobile()) return deepLinks.signup; // Used for href; click handler does deep link + fallback
  return '/sign-up';
}

/** Execute Sign Up flow: on mobile try deep link then store, on desktop go to /sign-up */
export function handleSignupClick(e: { preventDefault: () => void }): void {
  if (typeof window === 'undefined') return;
  const os = getMobileOS();
  if (os === 'ios' && APP_STORE_URL !== '#') {
    e.preventDefault();
    openAppOrStore({ path: 'signup', fallbackUrl: APP_STORE_URL });
  } else if (os === 'android' && PLAY_STORE_URL !== '#') {
    e.preventDefault();
    openAppOrStore({ path: 'signup', fallbackUrl: PLAY_STORE_URL });
  }
}

/** Open Sign In: mobile → deep link then store, desktop → /sign-in */
export function openSignin(): string {
  if (typeof window === 'undefined') return '/sign-in';
  if (isMobile()) return deepLinks.signIn;
  return '/sign-in';
}

/** Open Support */
export function openSupport(): string {
  return isMobile() ? deepLinks.support : `${WEB_BASE_URL}/support`;
}

/** Build auth callback deep link for app */
export function openAuthCallback({
  type,
  token,
  next,
}: {
  type: 'verify' | 'recovery';
  token: string;
  next?: string;
}): string {
  let url = `${APP_SCHEME}auth-callback?type=${type}&token=${encodeURIComponent(token)}`;
  if (next) url += `&next=${encodeURIComponent(next)}`;
  return url;
}

/** Build web auth callback URL */
export function getAuthCallbackWebUrl(type: 'verify' | 'recovery', token: string): string {
  return `${WEB_BASE_URL}/auth-callback?type=${type}&token=${encodeURIComponent(token)}`;
}
